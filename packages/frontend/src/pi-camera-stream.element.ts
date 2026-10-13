import {assert} from '@augment-vir/assert';
import {css, defineElement, html, onDomCreated} from 'element-vir';
import {playH264Stream} from './play-h264-stream.js';

export const PiCameraStream = defineElement()({
    tagName: 'pi-camera-stream',
    styles: css`
        :host {
            display: flex;
            height: 100%;
            width: 100%;
        }

        canvas {
            height: 100%;
            width: 100%;
            object-fit: contain;
        }
    `,
    state() {
        return {
            abortController: new AbortController(),
        };
    },
    render({state}) {
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
                    });
                })}
            ></canvas>
        `;
    },
    cleanup({state}) {
        state.abortController.abort();
    },
});
