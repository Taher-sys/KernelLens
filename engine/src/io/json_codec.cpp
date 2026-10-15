#include "kernellens/io/json_codec.hpp"
#include <nlohmann/json.hpp>
#include <stdexcept>

using json = nlohmann::json;

namespace kernellens::io {

std::string JsonCodec::encodeSimulationResult(const SimulationResult& result) {
    json j;
    j["version"] = "1.0";
    j["module"] = result.module;
    j["policy"] = result.policy;
    j["events"] = result.events;
    j["metrics"] = result.metrics;
    return j.dump();
}

SimulationRequest JsonCodec::decodeSimulationRequest(const std::string& json_str) {
    try {
        json j = json::parse(json_str);

        // Validate required fields
        if (!j.contains("version") || j["version"] != "1.0") {
            throw std::runtime_error("Invalid or missing version field");
        }

        if (!j.contains("module")) {
            throw std::runtime_error("Missing module field");
        }

        if (!j.contains("policy")) {
            throw std::runtime_error("Missing policy field");
        }

        SimulationRequest request;
        request.module = j["module"].get<std::string>();
        request.policy = j["policy"].get<std::string>();

        if (j.contains("config")) {
            request.config = j["config"].get<std::string>();
        }

        return request;
    } catch (const json::exception& e) {
        throw std::runtime_error("Invalid JSON: " + std::string(e.what()));
    }
}

std::string JsonCodec::encodeError(const std::string& message) {
    json j;
    j["error"] = message;
    return j.dump();
}

} // namespace kernellens::io