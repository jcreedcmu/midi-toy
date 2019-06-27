// inspired by https://twitter.com/luqui/status/1136488168436506624

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

async function aeach<T>(list: T[], k: (x: T) => Promise<void>) {
  for (const x of list) {
    await k(x);
  }
}

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
    let uiclass: string | undefined = undefined;
    if (s.mistake)
      uiclass = "wrong";
    else if (s.remainingInput.length == 0)
      uiclass = "right";
    return (
      <div id="ui" className={uiclass}>
        {JSON.stringify(s.playedInterval.map(x => x.p))}<br />
        {JSON.stringify(s.remainingInput.map(x => x.p))}
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
      if (data[1] == 24) {
        this.replaySoon();
        return;
      }
      if (this.state.remainingInput.length > 0) {
        this.setState(s => produce(s, s => {
          if (data[1] == s.remainingInput[0].p) {
            s.remainingInput.shift();
          }
          else {
            s.mistake = true;
          }
        }));
        if (this.state.remainingInput.length == 0) {
          this.newProblemSoon(this.state.mistake);
        }
      }
    }
  }

  async playNote(pitch: number) {
    this.outPort!.send([0x90, pitch, 0x28]);
    await delay(0.2);
    this.outPort!.send([0x80, pitch, 0x00]);
    await delay(0.1);
  }

  async replaySoon(): Promise<void> {
    await delay(0.5);
    this.play();
  }

  async newProblemSoon(mistake: boolean): Promise<void> {
    await delay(0.5);
    if (mistake) {
      [30].forEach(p => this.playNote(p));
    }
    else {
      [60, 64, 67, 72].forEach(p => this.playNote(p));
    }
    await delay(1);
    this.newProblem();
  }

  newProblem(): void {
    this.setState(s => generateRandomNote(s));
    this.play();
  }

  _handleKeyDown(e: KeyboardEvent) {
    if (e.keyCode == 32) {
      this.newProblem();
    }
    if (e.keyCode == 82 && !e.ctrlKey) {
      this.play();
    }
    console.log(e.keyCode);
  }

  async play(): Promise<void> {
    for (const n of this.state.playedInterval) {
      await this.playNote(n.p);
    }
  }
}

render(<App />, document.getElementById('root'));
