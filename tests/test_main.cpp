#include "test_harness.hpp"

int main() {
  return kernellens::testing::TestRegistry::instance().run_all();
}
