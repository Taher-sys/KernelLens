#pragma once

#include <iostream>
#include <string>
#include <vector>
#include <functional>
#include <cmath>

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

#define ASSERT_NEAR(a, b, eps) \
  do { \
    if (std::abs((a) - (b)) > (eps)) { \
      throw std::runtime_error(std::string("Assertion failed: |") + #a + " - " + #b + "| <= " + #eps + " at " + __FILE__ + ":" + std::to_string(__LINE__)); \
    } \
  } while (0)

} // namespace kernellens::testing
