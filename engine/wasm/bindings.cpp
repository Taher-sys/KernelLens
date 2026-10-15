#include <emscripten/bind.h>
#include "kernellens/core/simulation.hpp"
#include "kernellens/io/json_codec.hpp"

using namespace kernellens;
using namespace kernellens::io;

std::string runSimulationJson(const std::string& request_json) {
    try {
        SimulationRequest request = JsonCodec::decodeSimulationRequest(request_json);
        SimulationResult result = Simulation::run(request);
        return JsonCodec::encodeSimulationResult(result);
    } catch (const std::exception& e) {
        return JsonCodec::encodeError(e.what());
    }
}

EMSCRIPTEN_BINDINGS(kernellens) {
    emscripten::function("runSimulationJson", &runSimulationJson);
}