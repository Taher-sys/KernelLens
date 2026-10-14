# Claude Code Guidelines for KernelLens

## Quick Commands

- **Build Native**:
  `cmake -B build -S . -DCMAKE_BUILD_TYPE=Release && cmake --build build`
- **Run Tests**:
  `ctest --test-dir build --output-on-failure`
- **Run Engine CLI**:
  `./build/bin/kernellens --help`
- **Frontend Dev**:
  `cd frontend && npm install && npm run dev`
- **Build Frontend**:
  `cd frontend && npm run build`

## Architecture Rules

- C++17 standard compliance with `-Wall -Wextra -Wpedantic`.
- Integer discrete simulation ticks (`int64_t`). No floating point for simulated time.
- JSON output must strictly adhere to `docs/event-schema.md`.
- No memory leaks; use RAII and modern smart pointers (`std::unique_ptr`, `std::shared_ptr`).
- Each phase must compile cleanly and pass golden fixtures before committing.
