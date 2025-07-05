import process from 'node:process'
import type { AppModule } from '../AppModule.js'
import type { ModuleContext } from '../ModuleContext.js'

class ApplicationTerminatorOnLastWindowClose implements AppModule {
  enable({ app }: ModuleContext): void {
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit()
      }
    })
  }
}

export function terminateAppOnLastWindowClose(...args: ConstructorParameters<typeof ApplicationTerminatorOnLastWindowClose>) {
  return new ApplicationTerminatorOnLastWindowClose(...args)
}
