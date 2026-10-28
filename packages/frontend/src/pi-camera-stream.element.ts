import {assert} from '@augment-vir/assert';
import {css, defineElement, html, listen, onDomCreated} from 'element-vir';
import {
    createSizedIcon,
    LoaderAnimated24Icon,
    LucideRotateCwIcon,
    ViraButton,
    ViraColorVariant,
    ViraEmphasis,
    ViraIcon,
    ViraSize,
} from 'vira';
import {
    createFrontendState,
    type FrontendStateObservable,
} from './frontend-state/frontend-state.js';
import {playH264Stream} from './play-h264-stream.js';

export const PiCameraStream = defineElement()({
    tagName: 'pi-camera-stream',
    styles: css`
        :host {
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            height: 100%;
            width: 100%;
        }

        canvas {
            height: 100%;
            width: 100%;
            object-fit: contain;
        }

        ${ViraButton} {
            position: absolute;
            top: 8px;
            left: 8px;
            opacity: 0.4;
        }
    `,
    state() {
        return {
            abortController: new AbortController(),
            frontendState: undefined satisfies FrontendStateObservable | undefined as
                | FrontendStateObservable
                | undefined,
        };
    },
    init({updateState}) {
        void createFrontendState().then((frontendState) => {
            updateState({
                frontendState,
            });
        });
    },
    render({state}) {
        const frontendState = state.frontendState;

        /** Waits for the saved rotation so the first frame is drawn the right way up. */
        if (!frontendState) {
            return html`
                <${ViraIcon.assign({
                    icon: LoaderAnimated24Icon,
                })}></${ViraIcon}>
            `;
        }

        return html`
            <canvas
                ${onDomCreated((element) => {
                    assert.instanceOf(
                        element,
                        HTMLCanvasElement,
                        'Canvas is not a canvas element.',
                    );

                    void playH264Stream({
                        canvas: element,
                        abortSignal: state.abortController.signal,
                        readRotation() {
                            return frontendState.value.localDbClient.value.cameraRotation ?? 0;
                        },
                    });
                })}
            ></canvas>
            <${ViraButton.assign({
                icon: createSizedIcon(LucideRotateCwIcon, 24),
                buttonEmphasis: ViraEmphasis.Subtle,
                buttonSize: ViraSize.Large,
                color: ViraColorVariant.Neutral,
            })}
                title="Rotate 90°"
                ${listen('click', () => {
                    void frontendState.value.localDbClient.set.cameraRotation(
                        ((frontendState.value.localDbClient.value.cameraRotation ?? 0) + 90) % 360,
                    );
                })}
            ></${ViraButton}>
        `;
    },
    cleanup({state}) {
        state.abortController.abort();
        state.frontendState?.destroy();
    },
});
