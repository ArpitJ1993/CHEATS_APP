const byId = (id) => document.getElementById(id);

export const dom = {
  get startMicBtn() {
    return byId('startMicBtn');
  },
  get startSystemBtn() {
    return byId('startSystemBtn');
  },
  get stopBtn() {
    return byId('stopBtn');
  },
  get recordBtn() {
    return byId('recordBtn');
  },
  get modelSelect() {
    return byId('modelSelect');
  },
  get micSelect() {
    return byId('micSelect');
  },
  get micResults() {
    return byId('micResults');
  },
  get speakerResults() {
    return byId('speakerResults');
  },
  get micStatus() {
    return byId('micStatus');
  },
  get speakerStatus() {
    return byId('speakerStatus');
  },
  get recordStatus() {
    return byId('recordStatus');
  }
};


