#pragma once

#include "kernellens/disk/disk_scheduler.hpp"

namespace kernellens {

class DiskFcfsScheduler : public IDiskScheduler {
public:
  std::string name() const override { return "FCFS"; }
  DiskScheduleResult schedule(std::uint32_t initial_head, HeadDirection direction,
                              std::uint32_t max_cylinder,
                              const std::vector<std::uint32_t>& requests,
                              EventLog* log = nullptr) override;
};

class DiskSstfScheduler : public IDiskScheduler {
public:
  std::string name() const override { return "SSTF"; }
  DiskScheduleResult schedule(std::uint32_t initial_head, HeadDirection direction,
                              std::uint32_t max_cylinder,
                              const std::vector<std::uint32_t>& requests,
                              EventLog* log = nullptr) override;
};

class DiskScanScheduler : public IDiskScheduler {
public:
  std::string name() const override { return "SCAN"; }
  DiskScheduleResult schedule(std::uint32_t initial_head, HeadDirection direction,
                              std::uint32_t max_cylinder,
                              const std::vector<std::uint32_t>& requests,
                              EventLog* log = nullptr) override;
};

class DiskCScanScheduler : public IDiskScheduler {
public:
  std::string name() const override { return "C-SCAN"; }
  DiskScheduleResult schedule(std::uint32_t initial_head, HeadDirection direction,
                              std::uint32_t max_cylinder,
                              const std::vector<std::uint32_t>& requests,
                              EventLog* log = nullptr) override;
};

class DiskLookScheduler : public IDiskScheduler {
public:
  std::string name() const override { return "LOOK"; }
  DiskScheduleResult schedule(std::uint32_t initial_head, HeadDirection direction,
                              std::uint32_t max_cylinder,
                              const std::vector<std::uint32_t>& requests,
                              EventLog* log = nullptr) override;
};

class DiskCLookScheduler : public IDiskScheduler {
public:
  std::string name() const override { return "C-LOOK"; }
  DiskScheduleResult schedule(std::uint32_t initial_head, HeadDirection direction,
                              std::uint32_t max_cylinder,
                              const std::vector<std::uint32_t>& requests,
                              EventLog* log = nullptr) override;
};

} // namespace kernellens
