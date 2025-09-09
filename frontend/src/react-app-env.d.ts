/// <reference types="react-scripts" />

// Custom type declarations
declare namespace NodeJS {
  interface ProcessEnv {
    readonly NODE_ENV: 'development' | 'production' | 'test';
    readonly PUBLIC_URL: string;
    readonly REACT_APP_API_URL: string;
    readonly REACT_APP_WS_URL: string;
    readonly REACT_APP_VERSION: string;
  }
}

// Material-UI theme augmentation
declare module '@mui/material/styles' {
  interface Theme {
    customShadows?: {
      z1: string;
      z4: string;
      z8: string;
      z12: string;
      z16: string;
      z20: string;
      z24: string;
    };
  }
}

// Window extensions
declare global {
  interface Window {
    __REDUX_DEVTOOLS_EXTENSION_COMPOSE__?: typeof compose;
  }
}