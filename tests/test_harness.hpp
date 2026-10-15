#pragma once

#ifndef __cplusplus
#error "KernelLens test harness requires a C++17 compiler"
#endif

#include <iostream>
#include <string>
#include <vector>
#include <functional>
#include <cmath>
#include <stdexcept>
#include <utility>
#include <memory>
#include <cstdint>

namespace kernellens::testing {

struct TestCase {
  std::string name;
  std::function<void()> func;
};

class TestRegistry {
public:
  static TestRegistry& instance() {
    static TestRegistry reg;
    return reg;
  }

  void add(std::string name, std::function<void()> func) {
    tests_.push_back({std::move(name), std::move(func)});
  }

  int run_all() {
    int passed = 0;
    int failed = 0;
    std::cout << "\n=========================================\n"
              << " Running KernelLens Automated Test Suite\n"
              << "=========================================\n";

    for (const auto& test : tests_) {
      std::cout << "Running test: " << test.name << "..." << std::endl;
      try {
        test.func();
        std::cout << " [PASS] " << test.name << std::endl;
        passed++;
      } catch (const std::exception& e) {
        std::cout << " [FAIL] " << test.name << " — Error: " << e.what() << std::endl;
        failed++;
      } catch (...) {
        std::cout << " [FAIL] " << test.name << " — Unknown exception" << std::endl;
        failed++;
      }
    }

    std::cout << "-----------------------------------------\n"
              << " Total: " << tests_.size()
              << " | Passed: " << passed
              << " | Failed: " << failed << "\n"
              << "=========================================\n" << std::endl;
    return failed == 0 ? 0 : 1;
  }

private:
  std::vector<TestCase> tests_;
};

struct AutoRegister {
  AutoRegister(std::string name, std::function<void()> func) {
    TestRegistry::instance().add(std::move(name), std::move(func));
  }
};

#define TEST_CASE(name) \
  void test_##name(); \
  static ::kernellens::testing::AutoRegister reg_##name(#name, test_##name); \
  void test_##name()

#define ASSERT_TRUE(cond) \
  do { \
    if (!(cond)) { \
      throw std::runtime_error(std::string("Assertion failed: ") + #cond + " at " + __FILE__ + ":" + std::to_string(__LINE__)); \
    } \
  } while (0)

#define ASSERT_TRUE_MSG(cond, msg) \
  do { \
    if (!(cond)) { \
      throw std::runtime_error(std::string("Assertion failed: ") + #cond + " (" + (msg) + ") at " + __FILE__ + ":" + std::to_string(__LINE__)); \
    } \
  } while (0)

#define ASSERT_FALSE(cond) ASSERT_TRUE(!(cond))
#define ASSERT_FALSE_MSG(cond, msg) ASSERT_TRUE_MSG(!(cond), msg)

#define ASSERT_EQ(a, b) \
  do { \
    if ((a) != (b)) { \
      throw std::runtime_error(std::string("Assertion failed: ") + #a + " == " + #b + " at " + __FILE__ + ":" + std::to_string(__LINE__)); \
    } \
  } while (0)

#define ASSERT_NE(a, b) \
  do { \
    if ((a) == (b)) { \
      throw std::runtime_error(std::string("Assertion failed: ") + #a + " != " + #b + " at " + __FILE__ + ":" + std::to_string(__LINE__)); \
    } \
  } while (0)

#define ASSERT_NEAR(a, b, eps) \
  do { \
    if (std::abs((a) - (b)) > (eps)) { \
      throw std::runtime_error(std::string("Assertion failed: |") + #a + " - " + #b + "| <= " + #eps + " at " + __FILE__ + ":" + std::to_string(__LINE__)); \
    } \
  } while (0)

#define ASSERT_LT(a, b) ASSERT_TRUE((a) < (b))
#define ASSERT_LE(a, b) ASSERT_TRUE((a) <= (b))
#define ASSERT_GT(a, b) ASSERT_TRUE((a) > (b))
#define ASSERT_GE(a, b) ASSERT_TRUE((a) >= (b))

// GoogleTest Compatibility Aliases
#define EXPECT_TRUE(cond) ASSERT_TRUE(cond)
#define EXPECT_FALSE(cond) ASSERT_FALSE(cond)
#define EXPECT_EQ(a, b) ASSERT_EQ(a, b)
#define EXPECT_NE(a, b) ASSERT_NE(a, b)
#define EXPECT_NEAR(a, b, eps) ASSERT_NEAR(a, b, eps)
#define EXPECT_LT(a, b) ASSERT_LT(a, b)
#define EXPECT_LE(a, b) ASSERT_LE(a, b)
#define EXPECT_GT(a, b) ASSERT_GT(a, b)
#define EXPECT_GE(a, b) ASSERT_GE(a, b)

} // namespace kernellens::testing

// Global ::testing namespace for GoogleTest compatibility
namespace testing {
class Test {
public:
  virtual ~Test() = default;
  virtual void SetUp() {}
  virtual void TearDown() {}
};
} // namespace testing

#define TEST_F(FixtureClass, TestName) \
  class FixtureClass##_##TestName##_Class : public FixtureClass { \
  public: \
    void run() { \
      SetUp(); \
      TestBody(); \
      TearDown(); \
    } \
    void TestBody(); \
  }; \
  static ::kernellens::testing::AutoRegister reg_##FixtureClass##_##TestName(#FixtureClass "_" #TestName, []() { \
    FixtureClass##_##TestName##_Class fixture; \
    fixture.run(); \
  }); \
  void FixtureClass##_##TestName##_Class::TestBody()

#define TEST(Suite, Name) TEST_CASE(Suite##_##Name)

