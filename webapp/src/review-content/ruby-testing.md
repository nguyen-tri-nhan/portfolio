---
key: ruby-testing
title: "Ruby Testing — RSpec, FactoryBot & Capybara"
crumb: "21. Ruby > Testing"
---

RSpec là de facto standard test framework trong Ruby/Rails — DSL đẹp nhất trong web testing, ảnh hưởng nhiều framework khác (Jasmine, Jest). FactoryBot thay fixtures cho test data. Capybara cho integration/E2E test. VCR cho record/replay HTTP. Tương tự Java: RSpec ↔ JUnit 5 + Mockito, FactoryBot ↔ EasyRandom/Instancio, Capybara ↔ Selenium + Spring MockMvc.

## Điểm Chính

- **RSpec**: BDD-style — `describe`, `context`, `it`, `expect` — readable test descriptions
- **subject**: Object under test — tự động tạo instance của class trong `describe`
- **let / let!**: Lazy memoized setup — `let` lazy (chỉ tạo khi dùng), `let!` eager (tạo trước mỗi test)
- **before / after**: Hooks — `before(:each)` tương tự JUnit `@BeforeEach`, `before(:all)` tương tự `@BeforeAll`
- **Shared examples**: Reusable test group — `shared_examples_for`, `it_behaves_like`
- **FactoryBot**: Factory pattern cho test data — định nghĩa blueprint, generate với `build/create/build_stubbed`
- **Capybara**: DSL cho browser interaction — `visit`, `fill_in`, `click_button`, `have_content`
- **VCR**: Record HTTP interactions → replay trong test — tránh external API calls

## Ví Dụ Code

```ruby
# ============ RSPEC BASICS ============

RSpec.describe OrderService do
  # subject — tự động là described_class.new nếu không define
  subject(:service) { described_class.new(order_repo:, email_service:) }

  # let — lazy memoized (chỉ tạo khi first use trong test)
  let(:order_repo)   { instance_double(OrderRepository) }
  let(:email_service) { instance_double(EmailService) }
  let(:user)         { build(:user, balance: 100) }     # FactoryBot
  let(:order_params) { { user_id: user.id, amount: 50 } }

  # let! — eager (tạo trước mỗi example, ngay cả không dùng)
  let!(:existing_order) { create(:order, user: user) }

  # before/after hooks
  before(:each) do
    allow(order_repo).to receive(:find_user).with(user.id).and_return(user)
  end

  after(:each) do
    # cleanup if needed
  end

  # Group related tests bằng describe và context
  describe "#create" do
    context "when user has sufficient balance" do
      it "creates an order" do
        allow(order_repo).to receive(:save!).and_return(true)
        allow(email_service).to receive(:send_confirmation)

        order = service.create(order_params)

        expect(order).to be_a(Order)
        expect(order.status).to eq(:pending)
      end

      it "sends confirmation email" do
        allow(order_repo).to receive(:save!).and_return(true)
        expect(email_service).to receive(:send_confirmation).once

        service.create(order_params)
      end
    end

    context "when user has insufficient balance" do
      let(:user) { build(:user, balance: 0) }

      it "raises InsufficientFundsError" do
        expect { service.create(order_params) }
          .to raise_error(InsufficientFundsError, /insufficient/i)
      end

      it "does not send email" do
        expect(email_service).not_to receive(:send_confirmation)
        service.create(order_params) rescue nil
      end
    end
  end

  describe "#cancel" do
    let(:order) { create(:order, :pending, user: user) }

    it "changes status to cancelled" do
      expect { service.cancel(order.id) }
        .to change { order.reload.status }.from(:pending).to(:cancelled)
    end
  end
end

# ============ RSPEC MATCHERS ============

# Basic
expect(result).to eq(42)
expect(result).to be_nil
expect(result).to be_truthy
expect(result).to be_falsy
expect(result).not_to be_empty

# Comparisons
expect(age).to be > 18
expect(score).to be_between(0, 100).inclusive

# Type checking
expect(result).to be_a(String)
expect(result).to be_an_instance_of(User)
expect(User).to be_a_kind_of(Class)

# Collections
expect(users).to include(user)
expect(users).to have_attributes(count: 3)
expect(ids).to match_array([1, 2, 3])   # order-insensitive
expect(ids).to contain_exactly(3, 1, 2) # same, different syntax

# Exception
expect { dangerous_method }.to raise_error(ArgumentError)
expect { method_with_message }.to raise_error(RuntimeError, "specific message")
expect { method_with_match  }.to raise_error(/pattern match/)

# Change
expect { record.save }.to change { Record.count }.by(1)
expect { record.update(status: :active) }
  .to change { record.status }.from(:pending).to(:active)

# Compound matchers
expect(result)
  .to be_a(User)
  .and have_attributes(name: "Alice", email: /alice/)

# Custom matcher
RSpec::Matchers.define :be_valid_email do
  match { |email| email.match?(/\A[^@]+@[^@]+\z/) }
  failure_message { |email| "Expected #{email.inspect} to be valid email" }
end

expect(user.email).to be_valid_email

# ============ DOUBLES & MOCKING ============

# instance_double — verifying double (bắt sai method name/arity)
repo = instance_double(OrderRepository)

# class_double
klass = class_double(PaymentGateway)

# allow (stub)
allow(repo).to receive(:find).with(1).and_return(order)
allow(repo).to receive(:find).with(anything).and_return(nil)
allow(repo).to receive(:find).and_raise(RecordNotFound)

# expect (mock — verify được gọi)
expect(email_service).to receive(:send).with(hash_including(to: user.email)).once
expect(payment).to receive(:charge).with(100).ordered  # ordered call

# spy — track calls, no strict setup
spy_service = instance_spy(EmailService)
service.call  # do something that triggers email
expect(spy_service).to have_received(:send).once

# ============ FACTORYBOT ============

# spec/factories/users.rb
FactoryBot.define do
  factory :user do
    sequence(:name)  { |n| "User #{n}" }
    sequence(:email) { |n| "user#{n}@example.com" }
    age     { rand(18..65) }
    status  { :active }
    balance { 100.0 }
    role    { :user }

    # Traits
    trait :admin do
      role { :admin }
    end

    trait :premium do
      subscription { :premium }
      balance      { 1000.0 }
    end

    trait :inactive do
      status { :inactive }
    end

    # Association
    association :team, factory: :team

    # after hooks
    after(:create) do |user|
      create_list(:order, 3, user: user)
    end
  end
end

# Usage
user         = build(:user)              # không save vào DB
user         = create(:user)             # save vào DB
user         = build(:user, :admin)      # với trait
user         = create(:user, name: "Alice")  # override attribute
users        = create_list(:user, 5)     # tạo 5 records
user         = build_stubbed(:user)      # fake object không cần DB

# ============ CAPYBARA — INTEGRATION TEST ============

require 'capybara/rspec'

RSpec.describe "User Registration", type: :feature do
  scenario "user registers successfully" do
    visit "/register"

    fill_in "Name",     with: "Alice"
    fill_in "Email",    with: "alice@example.com"
    fill_in "Password", with: "secure123"
    fill_in "Password confirmation", with: "secure123"

    click_button "Register"

    expect(page).to have_content("Welcome, Alice!")
    expect(page).to have_current_path("/dashboard")
    expect(User.find_by(email: "alice@example.com")).to be_present
  end

  scenario "user sees error with invalid email" do
    visit "/register"
    fill_in "Email", with: "not-an-email"
    click_button "Register"

    expect(page).to have_css(".error", text: /email/i)
    expect(page).not_to have_content("Welcome")
  end

  # JavaScript test
  scenario "user can add items to cart", js: true do
    visit "/products"
    find("[data-product-id='1']").click
    click_button "Add to Cart"
    
    expect(page).to have_css(".cart-count", text: "1")
  end
end

# Capybara helpers
page.has_css?(".spinner")
page.has_no_content?("Loading...")
find(".form").fill_in("name", with: "Test")
all(".product-card").each { |card| expect(card).to have_css(".price") }
within(".sidebar") { expect(page).to have_link("Categories") }

# ============ VCR — RECORD/REPLAY HTTP ============

# spec/support/vcr.rb
VCR.configure do |config|
  config.cassette_library_dir = "spec/vcr_cassettes"
  config.hook_into :webmock
  config.configure_rspec_metadata!
  config.filter_sensitive_data('<API_KEY>') { ENV['API_KEY'] }
end

# Usage
RSpec.describe PaymentService do
  it "charges card successfully", vcr: true do
    # First run: records HTTP call to cassette file
    # Subsequent runs: replays from cassette — no real HTTP
    result = PaymentService.new.charge(amount: 100, card: "tok_visa")
    expect(result.success?).to be true
  end

  it "handles rate limit", vcr: { cassette_name: "payment/rate_limit" } do
    expect { service.charge(...) }.to raise_error(RateLimitError)
  end
end
```

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>let vs let! vs before(:each) — khác nhau và khi nào dùng cái nào?</strong></summary>

**A:** **`let`**: lazy memoized — chỉ tạo khi first access trong test, memoize trong example. Nếu test không dùng biến, không tạo — faster test suite. **`let!`**: eager — luôn tạo trước mỗi example, kể cả example không reference biến đó. Dùng khi cần side effects (tạo DB record để test count/presence). **`before(:each)`**: run trước mỗi example, không return value — dùng cho setup không cần reference variable, hoặc setup nhiều thứ. Rule: prefer `let` cho data setup, `let!` khi cần DB record tồn tại trước test, `before` cho `allow`/stub setup. **Memory**: `let` bị cleared sau mỗi example — không leak giữa tests.

</details>

<details>
<summary><strong>build vs create vs build_stubbed trong FactoryBot?</strong></summary>

**A:** **`build`**: tạo object in-memory, không save vào DB, trigger after_build hooks. **`create`**: tạo và save vào DB, trigger after_create hooks — chậm hơn vì DB write. **`build_stubbed`**: tạo object in-memory, fake ID và timestamps (như đã saved), không DB, không trigger active record callbacks — rất nhanh. Rule: prefer `build_stubbed` cho unit test không cần DB; `build` cho test cần object không có ID; `create` chỉ cho integration test cần real DB record. `build_stubbed` object không thể save/reload — phù hợp service test. `create_list(3, :user)` tạo 3 records — O(n) DB inserts.

</details>
