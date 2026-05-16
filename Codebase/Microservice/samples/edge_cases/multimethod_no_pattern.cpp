// Edge case — a plain utility class whose many small methods all
// return *this. The structural matcher latches onto the fluent shape
// and tags it as creational.method_chaining, but it is not a Builder
// or Method-Chaining type — there's no terminal build() / final
// operation, the methods are independent mutators.
// Expected analyser tag: creational.method_chaining (FALSE POSITIVE —
// the tester should record kind='none').

class CounterWithChainedSetters {
public:
    CounterWithChainedSetters& setMin(int v) { m_min = v; return *this; }
    CounterWithChainedSetters& setMax(int v) { m_max = v; return *this; }
    CounterWithChainedSetters& setStep(int v) { m_step = v; return *this; }
    CounterWithChainedSetters& reset() { m_value = m_min; return *this; }
    int current() const { return m_value; }
private:
    int m_min = 0;
    int m_max = 100;
    int m_step = 1;
    int m_value = 0;
};
