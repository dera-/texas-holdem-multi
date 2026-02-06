import { AllStatus } from "../type/status";

export const basicFont = new g.DynamicFont({
	game: g.game,
	fontFamily: "serif",
	size: 48
});

export abstract class BaseScene extends g.Scene {
	protected statusQueue: AllStatus[] = [];

	constructor(param: g.SceneParameterObject) {
		super(param);
		this.initialize(param);
		this.onLoad.add(this.handlerToLoad, this);
	}

	protected abstract initialize(param: any): void;

	protected attachButtonFeedback(
		entity: g.E,
		options?: {
			pressedScale?: number;
			pressedOffsetY?: number;
			pressedOpacity?: number;
			onPress?: () => void;
			onRelease?: () => void;
		}
	): void {
		const baseX = entity.x || 0;
		const baseY = entity.y || 0;
		const baseScaleX = entity.scaleX == null ? 1 : entity.scaleX;
		const baseScaleY = entity.scaleY == null ? 1 : entity.scaleY;
		const baseOpacity = entity.opacity == null ? 1 : entity.opacity;
		const pressedScale = options?.pressedScale ?? 0.96;
		const pressedOffsetY = options?.pressedOffsetY ?? 2;
		const pressedOpacity = options?.pressedOpacity ?? 0.9;
		entity.onPointDown.add(() => {
			entity.scaleX = baseScaleX * pressedScale;
			entity.scaleY = baseScaleY * pressedScale;
			entity.y = baseY + pressedOffsetY;
			entity.opacity = Math.max(0, baseOpacity * pressedOpacity);
			entity.modified();
			if (options?.onPress) {
				options.onPress();
			}
		});
		entity.onPointUp.add(() => {
			entity.scaleX = baseScaleX;
			entity.scaleY = baseScaleY;
			entity.y = baseY;
			entity.opacity = baseOpacity;
			entity.modified();
			if (options?.onRelease) {
				options.onRelease();
			}
		});
	}

	getCurrentStatus(): AllStatus {
		return this.statusQueue.length === 0 ? "NONE" : this.statusQueue[this.statusQueue.length - 1];
	}
	
	popStatus(): AllStatus {
		return this.statusQueue.length === 0 ? "NONE" : this.statusQueue.pop();
	}
	
	pushStatus(status: AllStatus): void {
		if (status === "NONE") {
			return;
		}
		this.statusQueue.push(status);
	}

	changeStatus(status: AllStatus): void {
		this.popStatus();
		this.pushStatus(status);
	}
	
	pushStatuses(statuses: AllStatus[]): void {
		statuses.forEach(status => {
			this.pushStatus(status);
		});
	}

	/**
	 * この中でエンティティやハンドラの登録等行う
	*/
	protected abstract handlerToLoad(): void;
}
