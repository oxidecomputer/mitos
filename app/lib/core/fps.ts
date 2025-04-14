/*
 * This Source Code Form is subject to the terms of the Apache License,
 * v. 2.0. If a copy of the license was not distributed with this file, you can
 * obtain one at https://github.com/ertdfgcvb/play.core/blob/master/LICENSE.
 *
 * Modified from https://github.com/ertdfgcvb/play.core
 * Copyright ertdfgcvb (Andreas Gysin)
 */
export type FPSType = {
  update: (time: number) => number
}

export default class FPS {
  private frames: number
  private ptime: number
  private fps: number

  constructor() {
    this.frames = 0
    this.ptime = 0
    this.fps = 0
  }

  update(time: number): number {
    this.frames++
    if (time >= this.ptime + 1000) {
      this.fps = (this.frames * 1000) / (time - this.ptime)
      this.ptime = time
      this.frames = 0
    }
    return this.fps
  }
}
