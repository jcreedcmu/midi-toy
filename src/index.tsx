import * as React from 'react';
import { render } from 'react-dom';
import { produce } from 'immer';

type Interval = { t: number };
type Note = { p: number };
type AppProps = {};
type AppState = {
  playedInterval: Note[],
  mistake: boolean,
  remainingInput: Note[],
};

function delay(seconds: number): Promise<void> {
  return new Promise((res, rej) => {
    setTimeout(res, seconds * 1000);
  });
}

function generateRandomNote(s: AppState): AppState {
  return produce(s, s => {
    const interval = Math.floor(Math.random() * 12) + 1;
    const pitch1 = Math.random() < 0.5 ? 0x3c : 0x35;
    s.mistake = false;
    s.remainingInput = [{ p: pitch1 }, { p: pitch1 + interval }];
    s.playedInterval = [{ p: pitch1 }, { p: pitch1 + interval }];
  });
}

function hex(x: number): string {
  return x.toString(16);
}

class App extends React.Component<AppProps, AppState> {
  outPort: WebMidi.MIDIOutput | undefined;


  constructor(p: AppProps) {
    super(p);
    this.state = {
      playedInterval: [],
      mistake: false,
      remainingInput: [],
    };
  }
  render() {
    const s = this.state;
    return (
      <div id="ui" className={s.remainingInput.length == 0 ? "right" : s.mistake ? "wrong" : undefined}>
        {JSON.stringify(s.playedInterval.map(x => x.p))}
      </div>
    );
  }
  componentDidMount() {
    navigator.requestMIDIAccess().then(
      (acc) => {
        for (const port of acc.outputs.values()) {
          if (!port.name!.match(/through/i)) {
            console.log(port);
            this.outPort = port;
          }
        }
        let inPort: WebMidi.MIDIInput | undefined;
        for (const port of acc.inputs.values()) {
          if (!port.name!.match(/through/i)) {
            console.log(port);
            inPort = port;
          }
        }
        inPort!.onmidimessage = this._handleMidi.bind(this);
      });


    document.addEventListener('keydown', this._handleKeyDown.bind(this));
  }
  componentWillUnmount() {
    document.removeEventListener('keydown', this._handleKeyDown.bind(this));
  }

  _handleMidi(m: WebMidi.MIDIMessageEvent) {
    const { data } = m;
    if (data[0] == 0x90 && data[2] > 0) {
      if (this.state.remainingInput.length > 0) {
        this.setState(s => produce(s, s => {
          if (data[1] == s.remainingInput[0].p) {
            s.remainingInput.shift();
          }
          else {
            s.mistake = true;
          }
        }));
      }
    }

  }
  _handleKeyDown(e: KeyboardEvent) {
    if (e.keyCode == 32) {
      this.setState(s => generateRandomNote(s));
      this.play();
    }
    if (e.keyCode == 114) {
      this.play();
    }
  }

  async play(): Promise<void> {
    for (const n of this.state.playedInterval) {
      this.outPort!.send([0x90, n.p, 0x28]);
      await delay(0.2);
      this.outPort!.send([0x80, n.p, 0x00]);
      await delay(0.1);
    }
  }
}

render(<App />, document.getElementById('root'));
