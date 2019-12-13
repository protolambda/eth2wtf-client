import CytoScape, {Layouts} from "cytoscape";
import ReconnectingWebSocket from "reconnecting-websocket";
import {
    EventTypeID,
    CY,
    GraphEventType, EventIndex, CustomLayoutOptions, defaultCustomLayoutOpts,
} from "./Constants";
import CustomLayout from "./CustomLayout";
import {BlockHeadersContentType} from "./BlockHeaders";

CytoScape.use(CustomLayout);

type WSStatusHandler = (status: boolean) => void;

type WSCloser = () => void;

const eventTypes: Record<number, GraphEventType> = {
    1: BlockHeadersContentType,
};

export class Graph {

    private onWsStatusChange: WSStatusHandler;

    private cy: CY;

    private _sendWS: undefined | ((msg: ArrayBufferView) => void);
    private _closeWS: undefined | WSCloser;

    public eventIndex = 0;

    private customOpts: CustomLayoutOptions;

    constructor(cy: CY, onWsStatusChange: WSStatusHandler) {
        this.cy = cy;
        this.onWsStatusChange = onWsStatusChange;
        this.customOpts = defaultCustomLayoutOpts;

        // TODO test compact view (no transform, plain un-ranked dag)
        // if (!opts.compact) {
        //     // @ts-ignore
        //     options.minLen = ((edge: EdgeSingularTraversing ) => edge.target().data('slot') - edge.source().data('slot'));
        // }

        setInterval(this.pushEventIndex, 1000)
    }

    pushEventIndex = () => {
        const buf = new ArrayBuffer(5);
        const dat = new DataView(buf);
        dat.setUint8(0, 1);
        dat.setUint32(1, this.eventIndex, true);
        this.sendWSMsg(dat);
    };

    fit() {
        this.cy.fit();
    }

    pan(x: number, y: number) {
        this.cy.pan({x: x, y: y})
    }

    close = () => {
        if (this._closeWS) {
            this._closeWS();
        }
    };

    setupWS = () => {
        const rws = new ReconnectingWebSocket('ws://localhost:4000/ws', [], {debug: true});
        rws.binaryType = 'arraybuffer';
        rws.addEventListener('close', () => this.onWsStatusChange(false));
        rws.addEventListener('open', () => this.onWsStatusChange(true));
        rws.addEventListener('message', this.onMessageEvent);
        this._sendWS = rws.send.bind(rws);
        this._closeWS = () => {
            this._sendWS = undefined;
            rws.close();
        };
    };

    sendWSMsg = ((msg: DataView) => {
        if(this._sendWS) {
            console.log("sending msg: ", msg);
            this._sendWS(msg);
        } else {
            console.log("not connected to WS, could not send msg: ", msg);
        }
    });

    public setLayoutOptions(customOpts: CustomLayoutOptions) {
        this.customOpts = customOpts;
        console.log("changing layout opts to: ", customOpts);
    }

    layoutDag = (fromIndex: EventIndex, toIndex: EventIndex) => {
        // const layout = this.cy.filter(function(element){
        //     const evIndex = element.data('eventIndex');
        //     return evIndex >= fromIndex && evIndex < toIndex
        // }).layout({
        //     options
        // });
        // layout.run();

        const options = {
            animate: true,
            animationDuration: 300,
            name: 'custom_layout',
            fit: false,
            customOpts: this.customOpts,
        };
        const layout = this.cy.layout(options);
        layout.run();
    };

    setupCY() {
        this.setLayoutOptions(defaultCustomLayoutOpts);
        this.pushEventIndex()
    }

    onMessageEvent = (ev: MessageEvent) => {
        const msg: ArrayBuffer = ev.data;
        if (msg.byteLength < 1) {
            console.log("msg too short");
            return;
        }

        const data = new DataView(msg);
        const msgType = data.getUint8(0);

        switch (msgType) {
            // 1: event updates
            case 1:
                if (msg.byteLength < 5) {
                    console.log(msg);
                    console.log("expected msg type and event index");
                    return;
                }
                let eventIndex: number = data.getUint32(1, true);

                const oldEventIndex = eventIndex;

                if (eventIndex > this.eventIndex) {
                    // TODO: buffer and process later.
                    console.log("event index too new, ignoring data, requesting new data");
                    this.pushEventIndex();
                    return;
                }

                this.cy.batch(() => {
                    let offset = 1 + 4;
                    while(msg.byteLength > offset) {

                        const eventId: EventTypeID = data.getUint8(offset);
                        console.log("ev index: ", eventIndex, " event ID: ", eventId, "current ev index: ", this.eventIndex);
                        offset += 1;
                        const eventByteLen: number = data.getUint32(offset, true);
                        console.log("ev byte len: %d", eventByteLen);
                        offset += 4;
                        eventTypes[eventId].processEvent(
                            new DataView(msg, offset, eventByteLen), eventIndex, this.cy);

                        offset += eventByteLen;
                        eventIndex += 1;
                    }
                    this.eventIndex = Math.max(eventIndex, this.eventIndex);
                    this.pushEventIndex();
                    // Layout the newly received events, along with latest 300 to connect them in a pretty way.
                    this.layoutDag(Math.max(oldEventIndex - 300, 0), this.eventIndex);
                });
                break;
            case 2:
                // TODO
                break;
            default:
                // TODO more response types
                break;
        }
    };
}
