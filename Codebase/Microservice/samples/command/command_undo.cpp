class Command {
public:
    virtual ~Command() = default;
    virtual void execute() = 0;
    virtual void undo() = 0;
};
class LightOnCommand : public Command {
public:
    void execute() override { on_ = true; }
    void undo() override { on_ = false; }
private:
    bool on_ = false;
};
