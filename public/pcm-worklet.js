// Collects microphone samples, downsamples them to 16 kHz mono, and posts them in 100 ms blocks.
// The AudioContext runs at the device's own rate (Firefox can't resample a microphone stream).
const TARGET_RATE = 16000;

class PcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / TARGET_RATE; // `sampleRate` is the context's rate, e.g. 48000
    this.size = 1600;
    this.buf = new Float32Array(this.size);
    this.n = 0;
    this.sum = 0;
    this.count = 0;
    this.pos = 0;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) {
      for (let i = 0; i < channel.length; i++) {
        // Average the input samples that fall into each output sample (a simple low-pass).
        this.sum += channel[i];
        this.count++;
        this.pos += 1;
        if (this.pos >= this.ratio) {
          this.pos -= this.ratio;
          this.emit(this.sum / this.count);
          this.sum = 0;
          this.count = 0;
        }
      }
    }
    return true;
  }

  emit(value) {
    this.buf[this.n++] = value;
    if (this.n === this.size) {
      this.port.postMessage(this.buf, [this.buf.buffer]);
      this.buf = new Float32Array(this.size);
      this.n = 0;
    }
  }
}

registerProcessor("pcm-capture", PcmCapture);
