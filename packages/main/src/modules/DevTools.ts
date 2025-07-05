import installExtension, { REACT_DEVELOPER_TOOLS } from 'electron-devtools-installer';
import type { AppModule } from "../AppModule.js";
import type { ModuleContext } from "../ModuleContext.js";



class DevTools implements AppModule {
  async enable(context: ModuleContext) {
    // Wait for app to be ready before setting up IPC
    context.app.whenReady().then(() => {
      if (process.env.NODE_ENV === 'development') {
        return installExtension.default(REACT_DEVELOPER_TOOLS, {
          loadExtensionOptions: {
            allowFileAccess: true,
          },
        })
      }
    });
  }
}

export function withDevTools(...args: ConstructorParameters<typeof DevTools>) {
  return new DevTools(...args);
}