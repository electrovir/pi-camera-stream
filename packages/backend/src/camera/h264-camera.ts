// cspell:words nopreview, rpicam

import {log} from '@augment-vir/common';
import {splitAccessUnits, type AccessUnit} from '@pi-camera-stream/common';
import {spawn, type ChildProcess} from 'node:child_process';

export type CameraSubscriber = {
    onAccessUnit: (accessUnit: Readonly<AccessUnit>) => void;
    /** Called if the camera process exits while this subscriber is still attached. */
    onEnd: () => void;
};

export type H264CameraOptions = {
    width: number;
    height: number;
    framerate: number;
};

/**
 * Shares one `rpicam-vid` process between all viewers. The process only runs while at least one
 * subscriber is attached because the camera can only be opened by one process at a time.
 */
export class H264Camera {
    protected cameraProcess: ChildProcess | undefined;
    protected readonly subscribers = new Set<CameraSubscriber>();

    constructor(protected readonly options: Readonly<H264CameraOptions>) {}

    /** Returns an unsubscribe callback. */
    public subscribe(subscriber: CameraSubscriber) {
        this.subscribers.add(subscriber);
        this.start();

        return () => {
            this.subscribers.delete(subscriber);

            if (!this.subscribers.size) {
                this.cameraProcess?.kill();
            }
        };
    }

    protected start() {
        if (this.cameraProcess) {
            return;
        }

        const cameraProcess = spawn(
            '/usr/bin/rpicam-vid',
            [
                '--timeout',
                '0',
                '--nopreview',
                '--codec',
                'h264',
                /** Repeat the SPS and PPS before every keyframe so viewers can join mid-stream. */
                '--inline',
                /** One keyframe per second, so a new viewer waits at most a second for video. */
                '--intra',
                String(this.options.framerate),
                '--flush',
                '--width',
                String(this.options.width),
                '--height',
                String(this.options.height),
                '--framerate',
                String(this.options.framerate),
                '--output',
                '-',
            ],
            {
                stdio: [
                    'ignore',
                    'pipe',
                    'inherit',
                ],
            },
        );
        this.cameraProcess = cameraProcess;

        const remainder: {current: Uint8Array} = {
            current: new Uint8Array(),
        };

        cameraProcess.stdout.on('data', (chunk: Buffer) => {
            const {accessUnits, remainder: newRemainder} = splitAccessUnits(
                Buffer.concat([
                    remainder.current,
                    chunk,
                ]),
            );
            remainder.current = newRemainder;

            accessUnits.forEach((accessUnit) => {
                this.subscribers.forEach((subscriber) => subscriber.onAccessUnit(accessUnit));
            });
        });

        cameraProcess.on('error', (error) => {
            log.error('Camera process failed:', error);
        });

        cameraProcess.on('close', () => {
            this.cameraProcess = undefined;

            if (cameraProcess.killed && this.subscribers.size) {
                /** A viewer joined while the previous process was still shutting down. */
                this.start();
            } else {
                this.subscribers.forEach((subscriber) => subscriber.onEnd());
                this.subscribers.clear();
            }
        });
    }
}
