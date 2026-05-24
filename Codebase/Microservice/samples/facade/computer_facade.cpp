class CPU { public: void freeze(); void jump(long addr); };
class Memory { public: void load(long pos, const char* data); };
class ComputerFacade {
public:
    void start() {
        cpu_.freeze();
        memory_.load(0, "boot");
        cpu_.jump(0);
    }
private:
    CPU cpu_;
    Memory memory_;
};
