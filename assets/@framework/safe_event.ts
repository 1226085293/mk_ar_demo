import * as cc from "cc";

class safe_event<T> extends cc.EventTarget {
	key: { [key in keyof T]: key } = new Proxy(Object.create(null), {
		get: (target, key) => key,
	});

	// @ts-ignore
	on<T2 extends keyof T, T3 extends T[T2]>(
		type_: T2 | T2[],
		callback_: T3,
		this_?: any,
		once_b_?: boolean
	): typeof callback_ | null {
		if (Array.isArray(type_)) {
			type_.forEach((v) => {
				super.on(v as any, callback_ as any, this_, once_b_);
			});
			return null;
		} else {
			return super.on(type_ as any, callback_ as any, this_, once_b_);
		}
	}

	// @ts-ignore
	once<T2 extends keyof T, T3 extends T[T2]>(
		type_: T2 | T2[],
		callback_: T3,
		this_?: any
	): typeof callback_ | null {
		if (Array.isArray(type_)) {
			type_.forEach((v) => {
				super.once(v as any, callback_ as any, this_);
			});
			return null;
		} else {
			return super.once(type_ as any, callback_ as any, this_);
		}
	}

	// @ts-ignore
	off<T2 extends keyof T, T3 extends T[T2]>(type_: T2 | T2[], callback_?: T3, this_?: any): void {
		if (Array.isArray(type_)) {
			type_.forEach((v) => {
				super.off(v as any, callback_ as any, this_);
			});
		} else {
			super.off(type_ as any, callback_ as any, this_);
		}
	}

	// @ts-ignore
	emit<T2 extends keyof T, T3 extends Parameters<T[T2]>>(type_: T2 | T2[], ...args_: T3): void {
		if (Array.isArray(type_)) {
			type_.forEach((v) => {
				super.emit(v as any, ...args_);
			});
		} else {
			super.emit(type_ as any, ...args_);
		}
	}

	// @ts-ignore
	hasEventListener<T2 extends keyof T>(type_: T2, callback_?: T[T2], target_?: any): boolean {
		return super.hasEventListener(type_ as any, callback_ as any, target_);
	}

	clear(): void {
		return super["clear"]();
	}
}

export default safe_event;
