---
key: rails-advanced
title: "Rails Advanced — Concerns, Service Objects & Patterns"
crumb: "21. Ruby > Rails Nâng Cao"
---

Rails nâng cao: tổ chức code vượt qua MVC cơ bản. Concern = module extraction, Service Object = business logic tách khỏi model, Query Object = complex query tách khỏi scope, Form Object = validation cho non-model form. Các pattern này giải quyết "Fat Model, Fat Controller" — vấn đề phổ biến khi Rails app grow.

## Điểm Chính

- **Concerns**: Module mixin cho model/controller — nhóm related behavior, tái sử dụng code (`include Concerns::Taggable`)
- **Service Objects (Plain Old Ruby Objects)**: Business logic phức tạp tách khỏi model — `CreateOrder.call(params)` thay `order.save_with_side_effects`
- **Query Objects**: Complex query tách thành class riêng — tránh scope bloat trong model
- **Form Objects**: Validation cho multi-model form hoặc form không map trực tiếp vào model
- **Callbacks Pitfalls**: `after_save`, `before_create` → khó test, khó debug, gây side effects không mong muốn
- **Decorators/Presenters**: View logic tách khỏi model — Draper gem hoặc SimpleDelegator
- **Background Jobs**: Sidekiq + ActiveJob cho async work — không block HTTP request
- **Hotwire/Turbo**: Rails 7 real-time update không cần SPA framework

## Ví Dụ Code

```ruby
# ============ CONCERNS ============

# app/models/concerns/searchable.rb
module Searchable
  extend ActiveSupport::Concern

  included do
    # Chạy khi module được include — tương tự Java static initializer
    scope :search, ->(query) {
      where("name ILIKE :q OR email ILIKE :q", q: "%#{sanitize_sql_like(query)}%")
    }
  end

  # Instance methods
  def matches_query?(query)
    name&.include?(query) || email&.include?(query)
  end

  # Class methods
  class_methods do
    def searchable_fields
      %w[name email]
    end
  end
end

# app/models/concerns/soft_deletable.rb
module SoftDeletable
  extend ActiveSupport::Concern

  included do
    default_scope { where(deleted_at: nil) }  # tự filter deleted records
    
    scope :deleted, -> { unscoped.where.not(deleted_at: nil) }
  end

  def soft_delete!
    update!(deleted_at: Time.current)
  end

  def restore!
    update!(deleted_at: nil)
  end

  def deleted?
    deleted_at.present?
  end
end

# Include vào model
class User < ApplicationRecord
  include Searchable
  include SoftDeletable
end

User.search("alice")      # scoped search
user.soft_delete!         # soft delete

# ============ SERVICE OBJECTS ============

# Khi model quá béo — tách business logic ra service

# ❌ Fat model — quá nhiều responsibility
class Order < ApplicationRecord
  def complete!
    update!(status: :completed)
    user.update!(loyalty_points: user.loyalty_points + points_earned)
    OrderMailer.confirmation(self).deliver_later
    InventoryService.new.deduct(items)
    notify_warehouse if total > 1000
  end
end

# ✅ Service object
class CompleteOrder
  Result = Struct.new(:success?, :order, :error, keyword_init: true)

  def self.call(order_id, **options)
    new(order_id, **options).call
  end

  def initialize(order_id, notify: true)
    @order   = Order.find(order_id)
    @notify  = notify
  end

  def call
    ActiveRecord::Base.transaction do
      @order.update!(status: :completed)
      award_loyalty_points
      deduct_inventory
      send_notifications if @notify
    end

    Result.new(success?: true, order: @order)
  rescue => e
    Result.new(success?: false, error: e.message)
  end

  private

  def award_loyalty_points
    @order.user.increment!(:loyalty_points, @order.points_earned)
  end

  def deduct_inventory
    InventoryService.new.deduct(@order.items)
  end

  def send_notifications
    OrderMailer.confirmation(@order).deliver_later
    WarehouseNotifier.notify(@order) if @order.total > 1000
  end
end

# Controller — clean
def complete
  result = CompleteOrder.call(params[:id])

  if result.success?
    render json: result.order
  else
    render json: { error: result.error }, status: :unprocessable_entity
  end
end

# ============ QUERY OBJECTS ============

# ❌ Fat model scope — khó maintain
class Order < ApplicationRecord
  scope :pending_for_users_with_premium_subscription_in_last_30_days,
    -> { ... complex join ... }
end

# ✅ Query Object
class PendingPremiumOrdersQuery
  def initialize(relation = Order.all)
    @relation = relation
  end

  def call(since: 30.days.ago)
    @relation
      .joins(:user)
      .where(users: { subscription: :premium })
      .where(status: :pending)
      .where("orders.created_at >= ?", since)
      .order("orders.created_at DESC")
  end
end

# Composable
query  = PendingPremiumOrdersQuery.new
orders = query.call(since: 7.days.ago)

# Với base relation
high_value = PendingPremiumOrdersQuery.new(Order.where("total > 100")).call

# ============ FORM OBJECTS ============

# Multi-model form hoặc form không map 1-1 vào model
class UserRegistrationForm
  include ActiveModel::Model
  include ActiveModel::Validations

  attr_accessor :name, :email, :password, :password_confirmation,
                :company_name, :company_size

  validates :name,                 presence: true, length: { minimum: 2 }
  validates :email,                presence: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :password,             presence: true, length: { minimum: 8 }
  validates :password_confirmation, presence: true
  validates :company_name,         presence: true

  validate :passwords_match

  def save
    return false unless valid?

    ActiveRecord::Base.transaction do
      user    = User.create!(name:, email:, password:)
      company = Company.create!(name: company_name, size: company_size)
      company.members.create!(user:, role: :owner)
    end

    true
  rescue ActiveRecord::RecordInvalid => e
    errors.add(:base, e.message)
    false
  end

  private

  def passwords_match
    errors.add(:password_confirmation, "doesn't match") if password != password_confirmation
  end
end

# Controller
def create
  @form = UserRegistrationForm.new(registration_params)

  if @form.save
    redirect_to dashboard_path, notice: "Welcome!"
  else
    render :new, status: :unprocessable_entity
  end
end

# ============ CALLBACKS PITFALLS ============

# ❌ Callback hell — side effects không kiểm soát được
class Order < ApplicationRecord
  after_create :send_email         # always send email khi create
  after_save   :update_inventory   # luôn update inventory khi save
  before_destroy :check_refund     # phức tạp khi test
end

# Test nightmare:
it "creates order" do
  expect(OrderMailer).to receive(:welcome)  # phải mock email trong unit test!
  expect(InventoryService).to receive(:deduct)  # phải mock inventory!
  Order.create!(...)
end

# ✅ Explicit over implicit
class OrdersController < ApplicationController
  def create
    order = Order.new(order_params)
    
    if order.save
      OrderMailer.confirmation(order).deliver_later  # explicit
      InventoryService.new.deduct(order.items)       # explicit
      render json: order, status: :created
    else
      render json: order.errors, status: :unprocessable_entity
    end
  end
end

# Hoặc dùng Service Object — all side effects trong service, bỏ callbacks

# ============ DECORATORS / PRESENTERS ============

# Draper gem
class UserDecorator < Draper::Decorator
  delegate_all

  def full_name
    "#{object.first_name} #{object.last_name}"
  end

  def status_badge
    case object.status
    when "active"   then h.content_tag(:span, "Active", class: "badge badge-green")
    when "inactive" then h.content_tag(:span, "Inactive", class: "badge badge-gray")
    end
  end

  def member_since
    h.time_ago_in_words(object.created_at) + " ago"
  end
end

# Controller
@user = User.find(params[:id]).decorate

# View
<%= @user.full_name %>
<%= @user.status_badge %>
<%= @user.member_since %>

# ============ BACKGROUND JOBS ============

# ActiveJob + Sidekiq
class ProcessPaymentJob < ApplicationJob
  queue_as :critical

  retry_on Stripe::RateLimitError, wait: :exponentially_longer, attempts: 5
  discard_on Stripe::CardError   # không retry nếu card declined

  def perform(order_id)
    order = Order.find(order_id)
    PaymentService.new.charge(order)
    order.update!(status: :paid)
    OrderMailer.receipt(order).deliver_now
  rescue => e
    order.update!(status: :payment_failed, error: e.message)
    raise  # re-raise để Sidekiq retry
  end
end

# Enqueue
ProcessPaymentJob.perform_later(order.id)
ProcessPaymentJob.set(wait: 5.minutes).perform_later(order.id)

# Sidekiq config (config/sidekiq.yml)
# :queues:
#   - [critical, 3]  # weight 3
#   - [default, 2]
#   - [low, 1]
```

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Concern vs Module — khác nhau thế nào trong Rails?</strong></summary>

**A:** `ActiveSupport::Concern` là module wrapper của Rails với hai cải tiến: (1) `included do ... end` — code trong block chạy trong context của **including class** (không phải module), nên `scope :active`, `belongs_to :user` hoạt động đúng; nếu không có Concern, phải dùng `self.included(base) { base.scope ... }`. (2) Dependency resolution — khi Module A include Module B, `included` của B chạy trong context của final including class. Khi nào dùng: Concern khi muốn thêm ActiveRecord/ActiveModel behavior (scopes, validations, associations); plain Module khi behavior không phụ thuộc Rails.

</details>

<details>
<summary><strong>Service Object có nhược điểm gì không?</strong></summary>

**A:** Service Objects giải quyết Fat Model nhưng có trade-offs: (1) **Proliferation** — mỗi operation thành class riêng → nhiều file nhỏ, khó navigate; (2) **Naming khó** — `CreateOrderWithInventoryAndNotification` → không clear; (3) **No standard interface** — mỗi team define khác nhau (`call`, `execute`, `perform`, `run`); (4) **Over-engineering** — simple CRUD không cần service object. Alternative: **Interactor** gem (chuẩn hóa interface `call`, chaining, rollback); **Dry-transaction** (functional pipeline). Rule: dùng Service Object khi có ≥2 model bị thay đổi, side effects (email, job), hoặc complex business rule. Simple CRUD → controller + model là đủ.

</details>
