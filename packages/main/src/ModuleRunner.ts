import type { AppModule } from './AppModule.js'
import type { ModuleContext } from './ModuleContext.js'
import { app } from 'electron'

class ModuleRunner {
  #moduleContext: ModuleContext

  constructor() {
    this.#moduleContext = this.#createModuleContext()
  }

  async init(module: AppModule) {
    console.log(`Initializing module: ${module.constructor.name}`)
    const p = module.enable(this.#moduleContext)

    if (p instanceof Promise) {
      await p
    }
  }

  getContext(): ModuleContext {
    return this.#moduleContext
  }

  #createModuleContext(): ModuleContext {
    return {
      app,
    }
  }
}

export function createModuleRunner() {
  return new ModuleRunner()
}
