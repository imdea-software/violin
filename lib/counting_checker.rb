require_relative 'history'
require_relative 'history_checker'
require_relative 'history_completer'
require_relative 'theories'
require_relative 'z3'

class CountingChecker < HistoryChecker
  include Z3

  def initialize(object, matcher, history, completion, incremental, bound: 0)
    super(object, matcher, history, completion, incremental)
    @theories = Theories.new(Z3.context)
    @solver = Z3.context.solver
    # theories_for(object).each(&@solver.method(:theory))
    # @solver.push if @incremental
    # @refresh = false
    #
    # # log.warn('Counting') {"I don't do completions."} if @completion
    # log.warn('Counting') {"I only do incremental."} unless @incremental

    @bound = bound
    @completed = {}
    (@bound+1).times do |j|
      (j+1).times do |i|
        @completed[[i,j]] = []
      end
    end
    @pending = {}
    @current = 0
    @return_happened = false
  end

  def show_intervals(scale: 2)
    ops = @history.map{|id| [id,["[#{id}]",@history.label(id)]]}.to_h
    id_j = ops.values.map{|id,_| id.length}.max
    op_j = ops.values.map{|_,op| op.length}.max
    @history.map do |id|
      intv, _ = @completed.find{|intv,ops| ops.include?(id)}
      i, j = intv if intv
      (i = @pending[id]; j = @current) unless intv
      i *= scale
      j *= scale
      "#{ops[id][0].ljust(id_j)} #{ops[id][1].ljust(op_j)}  #{' ' * i}#{'#' * (j-i+1)}"
    end * "\n"
  end

  def shift_intervals
    (@bound+1).times do |j|
      (j+1).times do |i|
        next if i == 0 && j == 0
        ii = (i>0) ? (i-1) : i
        jj = (j>0) ? (j-1) : j
        @completed[[ii,jj]].push *@completed[[i,j]]
        @completed[[i,j]].clear
      end
    end
    @pending.each do |id,i|
      @pending[id] = i-1 if i > 0
    end
  end

  def happens_before_pairs
    Enumerator.new do |y|
      @bound.times do |j|
        (j+1).times do |i|
          @completed[[i,j]].each do |id1|
            (j+1..@bound).each do |k|
              (k..@bound).each do |l|
                @completed[[k,l]].each do |id2|
                  y << [id1,id2]
                end
              end
            end
            @pending.each do |id2,k|
              y << [id1,id2] if k > j
            end
          end
        end
      end
    end    
  end

  def name; "Counting checker (#{@bound})" end

  def started!(id, method_name, *arguments)
    if @return_happened
      if @current < @bound
        @current += 1
      else
        shift_intervals
      end
      @return_happened = false
    end
    @pending[id] = @current
  end

  def completed!(id, *returns)
    @completed[[@pending[id],@current]] << id
    @pending.delete id
    @return_happened = true
  end

  def removed!(id)
    @completed.each{|_,ops| ops.delete id}
    @pending.delete id
  end

  def check_history(history)
    # @solver.push
    # @solver.theory history_labels_theory(history)
    # @solver.theory history_order_theory(happens_before_pairs)
    # @solver.theory history_domains_theory(history)

    @theories.theory(history, @object, order: happens_before_pairs).each do |th|
      @solver.assert th
    end
    sat = @solver.check
    @solver.reset

    # @solver.pop
    return [sat, 1]
  end

  def check_completions(history)
    num_checked = 0
    sat = false
    history.completions(HistoryCompleter.get(@object)).each do |complete_history|
      log.info('Counting') {"checking completion\n#{complete_history}"}
      sat, n = check_history(complete_history)
      num_checked += n
      break if sat
    end
    return [sat, num_checked]
  end

  def check()
    super()
    log.info('Counting') {"checking history\n#{@history}"}
    log.info('Counting') {"intervals:\n#{show_intervals}"}
    sat, _ = @completion ? check_completions(@history) : check_history(@history)
    log.info('Counting') {"result: #{sat ? "OK" : "violation"}"}
    flag_violation unless sat
  end

end
