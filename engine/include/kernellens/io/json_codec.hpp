#pragma once

#include <string>
#include "kernellens/core/simulation.hpp"

namespace kernellens::io {

class JsonCodec {
public:
    static std::string encodeSimulationResult(const SimulationResult& result);
    static SimulationResult decodeSimulationRequest(const std::string& json);

    static std::string encodeError(const std::string& message);
};

} // namespace kernellens::io