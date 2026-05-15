class MetricSensor {
public:
    double celsius() const { return 25.0; }
};

class FahrenheitAdapter {
    MetricSensor inner;
public:
    double fahrenheit() const {
        return inner.celsius() * 1.8 + 32.0;
    }
};
