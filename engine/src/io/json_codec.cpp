#include "kernellens/io/json_codec.hpp"
#include <sstream>
#include <stdexcept>
#include <regex>

namespace kernellens::io {

std::string JsonCodec::encodeSimulationResult(const SimulationResult& result) {
    std::ostringstream ss;
    ss << "{"
       << "\"schemaVersion\":1,"
       << "\"version\":\"1.0\","
       << "\"module\":\"" << result.module << "\","
       << "\"policy\":\"" << result.policy << "\","
       << "\"events\":" << (result.events.empty() ? "[]" : result.events) << ","
       << "\"metrics\":" << (result.metrics.empty() ? "{}" : result.metrics)
       << "}";
    return ss.str();
}

static std::string extract_string(const std::string& json_str, const std::string& key) {
    std::regex reg("\"" + key + "\"\\s*:\\s*\"([^\"]*)\"");
    std::smatch match;
    if (std::regex_search(json_str, match, reg) && match.size() > 1) {
        return match[1].str();
    }
    return "";
}

static std::int64_t extract_int(const std::string& json_str, const std::string& key, std::int64_t default_val = 0) {
    std::regex reg("\"" + key + "\"\\s*:\\s*(-?\\d+)");
    std::smatch match;
    if (std::regex_search(json_str, match, reg) && match.size() > 1) {
        return std::stoll(match[1].str());
    }
    return default_val;
}

SimulationRequest JsonCodec::decodeSimulationRequest(const std::string& json_str) {
    // Validate required version field
    if (json_str.find("\"version\"") == std::string::npos &&
        json_str.find("\"schemaVersion\"") == std::string::npos) {
        throw std::runtime_error("Invalid or missing version field");
    }

    if (json_str.find("\"module\"") == std::string::npos) {
        throw std::runtime_error("Missing module field");
    }

    if (json_str.find("\"policy\"") == std::string::npos) {
        throw std::runtime_error("Missing policy field");
    }

    SimulationRequest request;
    request.module = extract_string(json_str, "module");
    if (request.module.empty()) {
        throw std::runtime_error("Missing module field");
    }

    // Policy can be "policy": "NAME" or "policy": { "name": "NAME" }
    std::string pol = extract_string(json_str, "policy");
    if (pol.empty()) {
        std::regex reg_obj("\"policy\"\\s*:\\s*\\{[^}]*\"name\"\\s*:\\s*\"([^\"]+)\"");
        std::smatch match;
        if (std::regex_search(json_str, match, reg_obj) && match.size() > 1) {
            pol = match[1].str();
        }
    }
    if (pol.empty()) {
        throw std::runtime_error("Missing policy field");
    }
    request.policy = pol;

    std::string run_id = extract_string(json_str, "runId");
    if (run_id.empty()) run_id = extract_string(json_str, "run_id");
    request.run_id = run_id.empty() ? "default" : run_id;

    request.seed = static_cast<std::uint64_t>(extract_int(json_str, "seed", 42));
    request.quantum = static_cast<Tick>(extract_int(json_str, "quantum", 3));

    return request;
}

std::string JsonCodec::encodeError(const std::string& message) {
    std::ostringstream ss;
    ss << "{\"schemaVersion\":1,\"error\":\"" << message << "\"}";
    return ss.str();
}

} // namespace kernellens::io