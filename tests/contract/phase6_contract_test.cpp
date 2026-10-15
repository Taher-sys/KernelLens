#include <gtest/gtest.h>
#include "kernellens/core/simulation.hpp"
#include "kernellens/io/json_codec.hpp"
#include <fstream>
#include <string>

using namespace kernellens;
using namespace kernellens::io;

class Phase6ContractTest : public ::testing::Test {
protected:
    void SetUp() override {
        // Load golden request
        std::ifstream request_file("tests/contract/golden/phase6_request.json");
        if (!request_file.good()) {
            request_file.clear();
            request_file.open("../tests/contract/golden/phase6_request.json");
        }
        ASSERT_TRUE(request_file.good());
        request_json_ = std::string((std::istreambuf_iterator<char>(request_file)),
                                 std::istreambuf_iterator<char>());

        // Load golden response
        std::ifstream response_file("tests/contract/golden/phase6_response.json");
        if (!response_file.good()) {
            response_file.clear();
            response_file.open("../tests/contract/golden/phase6_response.json");
        }
        ASSERT_TRUE(response_file.good());
        golden_response_json_ = std::string((std::istreambuf_iterator<char>(response_file)),
                                         std::istreambuf_iterator<char>());
    }

    std::string request_json_;
    std::string golden_response_json_;
};

TEST_F(Phase6ContractTest, ContractTest) {
    // Run simulation
    SimulationRequest request = JsonCodec::decodeSimulationRequest(request_json_);
    SimulationResult result = Simulation::run(request);

    // Encode result
    std::string response_json = JsonCodec::encodeSimulationResult(result);

    // Compare with golden response
    ASSERT_EQ(response_json, golden_response_json_);
}