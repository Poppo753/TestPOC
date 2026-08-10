export interface DisposableController {
  destroy(): void;
}

export function combineControllers(
  controllers: readonly DisposableController[],
): DisposableController {
  return {
    destroy() {
      for (const controller of [...controllers].reverse()) controller.destroy();
    },
  };
}
