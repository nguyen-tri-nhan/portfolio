---
key: ruby-rails
title: "Ruby on Rails — Web Framework"
crumb: "21. Ruby > Ruby on Rails"
---

Ruby on Rails (Rails) là web framework theo "Convention over Configuration" — follow convention thì không cần config, Rails tự biết. Active Record pattern: model class map trực tiếp vào DB table, không cần define mapping. Java dev sẽ thấy Rails "magic" nhiều hơn Spring — ít boilerplate, nhưng cần hiểu convention để debug khi sai.

## Điểm Chính

- **Convention over Configuration**: `Post` model → `posts` table, `PostsController` → `/posts` route — follow naming = zero config
- **Active Record**: Model IS repository — `User.find(1)`, `User.where(status: :active)` trực tiếp trên class; không cần Repository layer riêng
- **MVC**: Model (ActiveRecord) + View (ERB/HTML) + Controller (ActionController) — tương tự Spring MVC
- **Migrations**: `rails generate migration` → Ruby file mô tả schema change — tương tự Flyway nhưng code thay SQL
- **Scaffolding**: `rails generate scaffold Post title:string body:text` → tạo model, migration, controller, views, routes
- **Gems**: Thư viện Ruby — tương tự Maven dependencies, quản lý bằng Bundler + Gemfile
- **Rails console**: `rails console` → REPL tương tác với toàn bộ app — rất hữu ích để debug, query data
- **Asset Pipeline / Sprockets**: Quản lý CSS/JS — ít dùng hơn ngày nay khi frontend tách riêng

## Ví Dụ Code

```ruby
# ============ ACTIVE RECORD — MODEL ============
# Không cần khai báo column — Rails đọc từ DB schema

class User < ApplicationRecord
  # Validations (tương tự Bean Validation @NotNull, @Email trong Java)
  validates :name,  presence: true, length: { maximum: 100 }
  validates :email, presence: true, uniqueness: true,
                    format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :age,   numericality: { greater_than: 0, less_than: 150 }, allow_nil: true

  # Associations (tương tự JPA @OneToMany, @ManyToOne)
  has_many :orders, dependent: :destroy    # user.orders
  has_many :products, through: :orders     # many-to-many
  belongs_to :team, optional: true

  # Callbacks (tương tự JPA @PrePersist, @PreUpdate)
  before_create :set_defaults
  after_save    :send_welcome_email, if: :saved_change_to_email?

  # Scopes (tương tự JPA @NamedQuery / Specification)
  scope :active,   -> { where(status: :active) }
  scope :adults,   -> { where("age >= ?", 18) }
  scope :recent,   -> { order(created_at: :desc).limit(10) }
  scope :by_team,  ->(team_id) { where(team_id: team_id) }

  # Custom methods
  def full_name
    "#{first_name} #{last_name}"
  end

  def admin?
    role == "admin"
  end

  private

  def set_defaults
    self.status = :active
    self.role   = :user
  end

  def send_welcome_email
    UserMailer.welcome(self).deliver_later
  end
end

# ============ ACTIVE RECORD QUERIES ============

# Basic finders
user  = User.find(1)            # find by PK, raise RecordNotFound nếu không có
user  = User.find_by(email: "a@b.com")  # find by attribute, return nil nếu không có
users = User.all                # SELECT * FROM users (lazy, chưa execute)
users = User.where(status: :active)     # WHERE status = 'active'

# Chaining (lazy evaluation — giống JPA Criteria)
User.active
    .adults
    .where("name LIKE ?", "%alice%")
    .order(created_at: :desc)
    .limit(10)
    .offset(20)

# Select specific columns
User.select(:id, :name, :email).where(status: :active)

# Eager loading — tránh N+1 (tương tự JPA @EntityGraph)
users = User.includes(:orders, :team).where(status: :active)
# => 1 query cho users + 1 cho orders + 1 cho team (không phải N+1)

# Aggregate
User.count
User.where(status: :active).count
User.average(:age)
User.maximum(:age)
User.group(:status).count
# => {"active" => 100, "inactive" => 20}

# CRUD
user = User.create!(name: "Alice", email: "alice@example.com")  # create + save
user.update!(name: "Alice Smith")
user.destroy

# Bulk operations
User.where(status: :inactive).destroy_all
User.where(status: :pending).update_all(status: :active)

# ============ CONTROLLER ============
# Tương tự Spring @RestController

class Api::UsersController < ApplicationController
  before_action :authenticate_user!           # tương tự Spring Security filter
  before_action :set_user, only: [:show, :update, :destroy]

  # GET /api/users
  def index
    @users = User.active.page(params[:page]).per(20)  # pagination với kaminari gem
    render json: @users
  end

  # GET /api/users/:id
  def show
    render json: @user
  end

  # POST /api/users
  def create
    @user = User.new(user_params)
    if @user.save
      render json: @user, status: :created
    else
      render json: { errors: @user.errors }, status: :unprocessable_entity
    end
  end

  # PATCH /api/users/:id
  def update
    if @user.update(user_params)
      render json: @user
    else
      render json: { errors: @user.errors }, status: :unprocessable_entity
    end
  end

  # DELETE /api/users/:id
  def destroy
    @user.destroy
    head :no_content
  end

  private

  def set_user
    @user = User.find(params[:id])
  end

  # Strong parameters — whitelist (tương tự @Valid với @RequestBody)
  def user_params
    params.require(:user).permit(:name, :email, :age, :team_id)
  end
end

# ============ ROUTING ============
# config/routes.rb

Rails.application.routes.draw do
  # RESTful resource routes (tự generate 7 routes chuẩn)
  resources :users do
    resources :orders, only: [:index, :create]  # nested routes
    member do
      post :activate   # POST /users/:id/activate
    end
    collection do
      get :search      # GET /users/search
    end
  end

  # API namespace
  namespace :api do
    namespace :v1 do
      resources :products, only: [:index, :show, :create]
    end
  end

  # Custom route
  get "/health", to: "health#check"
  root "home#index"
end

# ============ MIGRATIONS ============

# rails generate migration CreateUsers
class CreateUsers < ActiveRecord::Migration[7.1]
  def change
    create_table :users do |t|
      t.string  :name,   null: false
      t.string  :email,  null: false
      t.integer :age
      t.string  :status, default: "active"
      t.string  :role,   default: "user"
      t.references :team, foreign_key: true

      t.timestamps  # created_at, updated_at tự động
    end

    add_index :users, :email, unique: true
    add_index :users, :status
  end
end

# rails db:migrate       — apply migration
# rails db:rollback      — undo migration
# rails db:schema:dump   — dump schema

# ============ BACKGROUND JOBS ============
# Sidekiq (Redis-backed) — tương tự Spring @Async + message queue

class EmailNotificationJob < ApplicationJob
  queue_as :default
  retry_on StandardError, attempts: 3, wait: :exponentially_longer

  def perform(user_id, template)
    user = User.find(user_id)
    UserMailer.send(template, user).deliver_now
  end
end

# Enqueue job
EmailNotificationJob.perform_later(user.id, :welcome)
EmailNotificationJob.set(wait: 1.hour).perform_later(user.id, :reminder)

# ============ RAILS CONSOLE ============
# rails console — debug và query data thực tế

# Trong console:
# User.count
# User.where(status: :active).pluck(:email)
# User.find(1).orders.recent.first(5)
# User.create!(name: "Test", email: "test@example.com")
```

## Ứng Dụng Thực Tế

Rails phù hợp nhất cho CRUD-heavy web app với deadline nhanh — Shopify, GitHub, Airbnb, Basecamp đều build trên Rails. Convention over Configuration mạnh nhất khi follow đúng Rails way; phức tạp hơn khi cần custom (complex auth, microservices, non-RESTful API). Java Spring dev thường thấy Rails thiếu type safety và khó debug magic khi có vấn đề.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Active Record pattern là gì? Khác Repository pattern thế nào?</strong></summary>

**A:** **Active Record**: object biết cách tự save/load/delete mình từ DB — `user.save`, `User.find(1)`, `user.destroy`. Model, persistence, và business logic trong cùng class. Rails ActiveRecord implement pattern này. **Repository pattern**: tách persistence ra khỏi domain object — `UserRepository.save(user)`, `UserRepository.findById(1)` — Java JPA/Spring Data dùng pattern này. **Trade-off**: Active Record đơn giản, ít code, phù hợp app CRUD đơn giản; Repository tách biệt hơn, testable hơn (mock repository dễ), phù hợp domain logic phức tạp. Rails không force Repository nhưng có thể layer thêm Service Object và Query Object để tách concern khi cần.

</details>

<details>
<summary><strong>N+1 query trong Rails xảy ra thế nào và fix thế nào?</strong></summary>

**A:** N+1 trong Rails thường từ lazy loading: `users = User.all` → 1 query; `users.each { |u| u.orders }` → N query (1 per user). Fix với `includes`: `User.includes(:orders)` → Rails load tất cả orders trong 1 query rồi map vào đúng user. `includes` dùng 2 query (1 cho users, 1 cho orders với WHERE IN) — tốt khi N lớn. `joins` + `eager_load` dùng LEFT JOIN — 1 query nhưng có thể lớn hơn. Gem **bullet** phát hiện N+1 tự động trong development bằng cách log warning. Trong Rails 7, Strict Loading mode (`strict_loading: true`) throw exception khi lazy load không cho phép — force dev phải include trước.

</details>
