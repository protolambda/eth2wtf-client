import React, {Component} from 'react';
import Slider from "@material-ui/core/Slider";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Checkbox from "@material-ui/core/Checkbox";
import FormGroup from "@material-ui/core/FormGroup";
import "./LayoutOptions.css";
import {CustomLayoutOptions} from "../graph/Constants";

type LayoutOptionsState = {
    data: CustomLayoutOptions
}

interface LayoutOptionsProps {
    onOptions: (data: CustomLayoutOptions) => void
}

export const defaultLayoutOpts: Readonly<CustomLayoutOptions> = {
    compact: false,
    nodeSep: 10,
    slotSep: 10,
    pullLatest: false,
};

export class LayoutOptions extends Component<LayoutOptionsProps, LayoutOptionsState> {

    state: Readonly<LayoutOptionsState> = {
        data: defaultLayoutOpts,
    };

    setRanker(event: React.ChangeEvent<{ name?: string; value: unknown }>) {
        this.setState(s => ({
            data: {
                ...s.data,
                [event.target.name as string]: event.target.value,
            },
        }), () => this.props.onOptions(this.state.data));
    }

    setBasic = (key: string) => (event: any, newValue: number | number[] | boolean) => {
        this.setState(s => ({
            data: {
                ...s.data,
                [key]: newValue
            }
        }), () => this.props.onOptions(this.state.data));
    };

    render() {
        const data = this.state.data;

        return (
            <FormGroup>
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={data.compact}
                            onChange={this.setBasic('compact')}
                            value="compact"
                            color="primary"
                        />
                    }
                    label="Compact graph"
                />
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={data.pullLatest}
                            onChange={this.setBasic('pullLatest')}
                            value="compact"
                            color="primary"
                        />
                    }
                    label="Pull latest to end"
                />

                <FormControlLabel
                    control={
                        <Slider
                            className="layout-slider"
                            min={1}
                            max={100}
                            defaultValue={data.nodeSep}
                            onChangeCommitted={this.setBasic('nodeSep')}
                            step={1}
                            valueLabelDisplay="auto"
                        />
                    }
                    label="Node separation"
                />

                <FormControlLabel
                    control={
                        <Slider
                            className="layout-slider"
                            min={1}
                            max={200}
                            defaultValue={data.slotSep}
                            onChangeCommitted={this.setBasic('slotSep')}
                            step={1}
                            valueLabelDisplay="auto"
                        />
                    }
                    label="Slot separation"
                />
            </FormGroup>
        );
    }
}
