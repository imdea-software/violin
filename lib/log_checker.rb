#!/usr/bin/env ruby

require 'optparse'
require 'logger'
require 'os'

module Kernel
  def log
    @@logger ||= (
      l = Logger.new(STDOUT,'daily')
      l.formatter = proc do |severity, datetime, progname, msg|
        "[#{progname || severity}] #{msg}\n"
      end
      l
    )
  end
end

require_relative 'history'
require_relative 'execution_log_parser'
require_relative 'history_checker'
require_relative 'lineup_checker'
require_relative 'satisfaction_checker'
require_relative 'saturation_checker'
require_relative 'obsolete_remover'

log.level = Logger::WARN

@checker = nil
@completion = false
@incremental = false
@obsolete_removal = false
@checkers = [:lineup, :smt, :saturation]
# @frequency = 1

OptionParser.new do |opts|
  opts.banner = "Usage: #{File.basename $0} [options] FILE"

  opts.separator ""

  opts.on("-h", "--help", "Show this message.") do
    puts opts
    exit
  end

  opts.on('-q', "--quiet", "Display only error messages.") do |q|
    log.level = Logger::ERROR
  end

  opts.on("-v", "--verbose", "Display informative messages too.") do |v|
    log.level = Logger::INFO
  end

  opts.on("-d", "--debug", "Display debugging messages too.") do |d|
    log.level = Logger::DEBUG
  end

  opts.separator ""
  opts.separator "Specify which algorithm to use, from {#{@checkers * ", "}}"

  opts.on("-a", "--algorithm NAME", @checkers, "(default: none)") do |c|
    @checker = c
  end

  opts.separator ""
  opts.separator "Plus any combination of these flags:"

  opts.on("-c", "--[no-]completion",
    "History completion? (default #{@completion}).") do |c|
    @completion = c
  end

  opts.on("-i", "--[no-]incremental",
    "Incremental checking? (default #{@incremental}).") do |i|
    @incremental = i
  end

  opts.on("-r", "--[no-]remove-obsolete",
    "Remove operations? (default #{@obsolete_removal}).") do |r|
    @obsolete_removal = r
  end

  # opts.on("--frequency N", Integer,
  #   "Check every N steps (default #{@frequency})") do |n|
  #   @frequency = n
  # end
end.parse!

begin
  execution_log = ARGV.first
  unless execution_log && File.exists?(execution_log)
    log.fatal "Invalid or missing execution-log file '#{execution_log}'."
    exit
  end

  log_parser = ExecutionLogParser.new(execution_log)
  history = History.new
  @checker =
    case @checker
    when :lineup;     LineUpChecker
    when :smt;        SatisfactionChecker
    when :saturation; SaturationChecker
    else              HistoryChecker
    end.new(log_parser.object, history, @completion, @incremental)

  # NOTE be careful, order is important here...
  # should check the histories before removing obsolete operations
  history.add_observer(@checker)
  history.add_observer(ObsoleteRemover.get(log_parser.object,history)) if @obsolete_removal

  num_steps = 0
  max_size = 0
  cum_size = 0
  max_rss = 0

  # measure memory usage in a separate thread, since a relatively expensive
  # system call is used
  rss_thread = Thread.new do
    rss = OS.rss_bytes
    max_rss = rss if rss > max_rss
    sleep 1
  end

  start_time = Time.now

  log_parser.parse! do |act, method_or_id, *values|
    break if @checker.violation?

    num_steps += 1
    size = history.count
    max_size = size if size > max_size
    cum_size += size

    case act
    when :call;   next history.start!(method_or_id, *values)
    when :return; next history.complete!(method_or_id, *values)
    else          fail "Unexpected action."
    end
  end

  end_time = Time.now

  puts "OBJECT:     #{log_parser.object || "?"}"
  puts "CHECKER:    #{@checker}"
  puts "REMOVAL:    #{@obsolete_removal}"
  puts "VIOLATION:  #{@checker.violation?}"
  puts "STEPS:      #{num_steps}"
  puts "AVG SIZE:   #{cum_size * 1.0 / num_steps}"
  puts "MAX SIZE:   #{max_size}"
  puts "CHECKS:     #{@checker.num_checks}"
  puts "MEMORY:     #{max_rss / 1024.0}KB"
  puts "TIME:       #{end_time - start_time}s"
  puts "TIME/CHECK: #{(end_time - start_time)/@checker.num_checks}s"
ensure
  log.close
end