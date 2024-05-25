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

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

/**
 * Data Point Formatting Card
 */
class GeneralSettings extends FormattingSettingsCard {

    displayPoints = new formattingSettings.ToggleSwitch({
        name: "displayPoints",
        displayName: "Display Points",
        value: false,
    })

    autoScaleY = new formattingSettings.ToggleSwitch({
        name: "autoScaleY",
        displayName: "Auto Scale Y",
        value: true,
    })

    minRangeY = new formattingSettings.NumUpDown({
        name: "minRangeY",
        displayName: "Min Range Y",
        value: -99999,
        visible: false
    });

    maxRangeY = new formattingSettings.NumUpDown({
        name: "maxRangeY",
        displayName: "Max Range Y",
        value: 99999,
        visible: false
    });

    name: string = "general";
    displayName: string = "General";
    slices: Array<FormattingSettingsSlice> = [this.displayPoints, this.autoScaleY, this.minRangeY, this.maxRangeY];
}

/**
* visual settings model class
*
*/
export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    // Create formatting settings model formatting cards
    generalSettings = new GeneralSettings();

    cards = [this.generalSettings];

    public displayInputFieldsAxisY() {
        this.generalSettings.minRangeY.visible = true
        this.generalSettings.maxRangeY.visible = true
    }

    public hideInputFieldsAxisY() {
        this.generalSettings.minRangeY.visible = false
        this.generalSettings.maxRangeY.visible = false
    }
}
