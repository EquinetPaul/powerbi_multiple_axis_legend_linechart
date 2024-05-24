/*
 *  Power BI Visualizations
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

"use strict";

import powerbiVisualsApi from "powerbi-visuals-api";
import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import ISelectionId = powerbiVisualsApi.visuals.ISelectionId;

import Card = formattingSettings.SimpleCard;
import Model = formattingSettings.Model;
import Slice = formattingSettings.Slice;
import ColorPicker = formattingSettings.ColorPicker;

interface LineChartDataPoint {
    value: number;
    category: string;
    color: string;
    selectionId: ISelectionId;
}

class ColorSelectorCardSettings extends Card {
    name: string = "colorSelector";
    displayName: string = "Data Colors";
    slices: Slice[] = [];
}

/**
* LineChart formatting settings model class
*/
export class LineChartSettingsModel extends Model {
    colorSelector = new ColorSelectorCardSettings();

    cards: Card[] = [this.colorSelector];

    /**
     * populate colorSelector object categories formatting properties
     * @param dataPoints 
     */
    populateColorSelector(dataPoints: LineChartDataPoint[]) {
        const slices: Slice[] = this.colorSelector.slices;
        if (dataPoints) {
            dataPoints.forEach(dataPoint => {
                slices.push(new ColorPicker({
                    name: "fill",
                    displayName: dataPoint.category,
                    value: { value: dataPoint.color },
                    selector: dataPoint.selectionId.getSelector(),
                }));
            });
        }
    }
}
