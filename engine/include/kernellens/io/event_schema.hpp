#pragma once

#include <string>
#include <vector>
#include "kernellens/core/simulation.hpp"

namespace kernellens::io {

struct SimEvent {
    int64_t tick;
    std::string module;
    std::string type;
    std::string payload;
};

struct EventLog {
    std::vector<SimEvent> events;
};

} // namespace kernellens::io