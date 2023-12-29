import GObject from "gi://GObject?version=2.0";
import St from "gi://St?version=13";
import Shell from "gi://Shell?version=13";
import Pango from "gi://Pango?version=1.0";
import Clutter from "gi://Clutter?version=13";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";

import MediaControls from "../extension.js";
import PlayerProxy from "./PlayerProxy.js";
import { LabelTypes, PanelElements, PlaybackStatus } from "../types/enums.js";
import { debugLog } from "../utils/common.js";

const SCROLL_ANIMATION_SPEED = 0.04;

class PanelButton extends PanelMenu.Button {
    private playerProxy: PlayerProxy;
    private extension: MediaControls;

    private icon: St.Icon;
    private labelView: St.ScrollView;
    private controlsBox: St.BoxLayout;
    private box: St.BoxLayout;

    constructor(playerProxy: PlayerProxy, extension: MediaControls) {
        super(0.5, "Media Controls", false);

        this.playerProxy = playerProxy;
        this.extension = extension;

        this.drawWidgets();
        this.addListeners();
    }

    public updateProxy(playerProxy: PlayerProxy) {
        this.playerProxy = playerProxy;
        this.drawWidgets();
    }

    public isSamePlayer(playerProxy: PlayerProxy) {
        return this.playerProxy.busName === playerProxy.busName;
    }

    public drawWidgets() {
        this.remove_all_children();
        this.box = new St.BoxLayout({
            styleClass: "panel-button-box",
        });

        for (const element of this.extension.elementsOrder) {
            if (this.extension.showPlayerIcon && PanelElements[element] === PanelElements.ICON) {
                this.addIcon();
            } else if (this.extension.showLabel && PanelElements[element] === PanelElements.LABEL) {
                this.addLabel();
            } else if (this.extension.showControlIcons && PanelElements[element] === PanelElements.CONTROLS) {
                this.addControls();
            }
        }

        this.add_child(this.box);
        debugLog("Added widgets");
    }

    private addListeners() {
        this.playerProxy.onChanged("Metadata", () => {
            this.drawWidgets();
        });
    }

    private addIcon() {
        const appSystem = Shell.AppSystem.get_default();
        const runningApps = appSystem.get_running();
        const app = runningApps.find((app) => app.get_name() === this.playerProxy.identity);

        if (app == null) {
            return;
        }

        const coloredClass = this.extension.coloredPlayerIcon ? "colored-icon" : "symbolic-icon";

        this.icon = new St.Icon({
            gicon: app.get_icon(),
            styleClass: `system-status-icon ${coloredClass}`,
        });

        this.box.add_child(this.icon);
        debugLog("Added icon");
    }

    private addLabel() {
        this.labelView = new St.ScrollView({
            hscrollbarPolicy: St.PolicyType.NEVER,
            vscrollbarPolicy: St.PolicyType.NEVER,
        });

        const box = new St.BoxLayout({
            xExpand: true,
            yExpand: true,
            width: this.extension.width,
        });

        const label = new St.Label({
            text: this.getLabelText(),
            yAlign: Clutter.ActorAlign.CENTER,
        });

        if (this.extension.scrollLabels) {
            const adjustment = this.labelView.hscroll.adjustment;
            const origText = label.text;

            const signalId = adjustment.connect("changed", () => {
                if (adjustment.upper <= adjustment.pageSize) {
                    return;
                }

                const initial = adjustment.value;
                const final = adjustment.upper;
                const duration = adjustment.upper / SCROLL_ANIMATION_SPEED;

                const pspec = adjustment.find_property("value");
                const interval = new Clutter.Interval({
                    valueType: pspec.value_type,
                    initial,
                    final,
                });

                const transition = new Clutter.PropertyTransition({
                    propertyName: "value",
                    progressMode: Clutter.AnimationMode.LINEAR,
                    repeatCount: -1,
                    duration,
                    delay: 0,
                    interval,
                });

                label.text = `${origText} ${origText}`;
                adjustment.add_transition("scroll", transition);
                adjustment.disconnect(signalId);
            });

            label.text = `${origText} `;
            label.clutterText.ellipsize = Pango.EllipsizeMode.NONE;
        }

        box.add_child(label);
        this.labelView.add_actor(box);
        this.box.add_child(this.labelView);

        debugLog("Added label");
    }

    private addControls() {
        this.controlsBox = new St.BoxLayout();

        if (this.extension.showControlIconsSeekBackward) {
            this.addControlIcon("media-seek-backward-symbolic");
        }

        if (this.extension.showControlIconsPrevious) {
            this.addControlIcon("media-skip-backward-symbolic");
        }

        if (this.extension.showControlIconsPlay) {
            if (this.playerProxy.playbackStatus === PlaybackStatus.PLAYING) {
                this.addControlIcon("media-playback-pause-symbolic");
            } else if (this.playerProxy.playbackStatus === PlaybackStatus.PAUSED) {
                this.addControlIcon("media-playback-start-symbolic");
            } else if (this.playerProxy.playbackStatus === PlaybackStatus.STOPPED) {
                this.addControlIcon("media-playback-start-symbolic");
            }
        }

        if (this.extension.showControlIconsNext) {
            this.addControlIcon("media-skip-forward-symbolic");
        }

        if (this.extension.showControlIconsSeekForward) {
            this.addControlIcon("media-seek-forward-symbolic");
        }

        this.box.add_child(this.controlsBox);
        debugLog("Added controls");
    }

    private addControlIcon(iconName: string) {
        const icon = new St.Icon({
            icon_name: iconName,
            styleClass: "system-status-icon",
        });

        this.controlsBox.add_child(icon);
    }

    private getLabelText() {
        const labelTextElements = [];

        for (const labelElement of this.extension.labelsOrder) {
            if (LabelTypes[labelElement] === LabelTypes.TITLE) {
                labelTextElements.push(this.playerProxy.metadata["xesam:title"]);
            } else if (LabelTypes[labelElement] === LabelTypes.ARTIST) {
                labelTextElements.push(this.playerProxy.metadata["xesam:artist"].join(", "));
            } else if (LabelTypes[labelElement] === LabelTypes.ALBUM) {
                labelTextElements.push(this.playerProxy.metadata["xesam:album"]);
            } else if (LabelTypes[labelElement] === LabelTypes.DISC_NUMBER) {
                labelTextElements.push(this.playerProxy.metadata["xesam:discNumber"]);
            } else if (LabelTypes[labelElement] === LabelTypes.TRACK_NUMBER) {
                labelTextElements.push(this.playerProxy.metadata["xesam:trackNumber"]);
            } else {
                labelTextElements.push(labelElement);
            }
        }

        return labelTextElements.join(" ");
    }
}

const classPropertiers = {
    GTypeName: "McPanelButton",
    Properties: {},
};

export default GObject.registerClass(classPropertiers, PanelButton);