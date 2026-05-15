#include <memory>

class AudioMixerImpl;

class AudioMixer {
    std::unique_ptr<AudioMixerImpl> impl_;
public:
    AudioMixer();
    ~AudioMixer();
    void play();
    void stop();
};
