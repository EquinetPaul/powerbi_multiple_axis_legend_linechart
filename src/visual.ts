/*
*  Power BI Visual CLI
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

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import "./../style/visual.less";

import * as d3 from "d3";
import IVisual = powerbi.extensibility.visual.IVisual;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import DataView = powerbi.DataView;

import { VisualFormattingSettingsModel } from "./settings";

interface DataPoint {
    date: Date;
    value: number;
    category: string;
}

interface VisualData {
    dataPoints: DataPoint[];
    categories: string[];
}

export class Visual implements IVisual {
    private svg: d3.Selection<SVGElement, unknown, HTMLElement, any>;
    private margin = { top: 20, right: 20, bottom: 30, left: 50 };
    private width: number;
    private height: number;

    constructor(options: VisualConstructorOptions) {
        this.svg = d3.select(options.element)
            .append('svg')
            .classed('line-chart', true);
        
        this.svg.attr('width', this.width + this.margin.left + this.margin.right)
            .attr('height', this.height + this.margin.top + this.margin.bottom);

        this.svg.append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
    }

    public update(options: VisualUpdateOptions) {
        this.width = options.viewport.width - this.margin.left - this.margin.right;
        this.height = options.viewport.height - this.margin.top - this.margin.bottom;

        const dataView: DataView = options.dataViews[0];
        const visualData = this.getVisualData(dataView);

        this.drawChart(visualData);
    }

    private getVisualData(dataView: DataView): VisualData {
        const category = dataView.categorical.categories[0];
        const valueColumns = dataView.categorical.values;

        const dataPoints: DataPoint[] = [];
        const categories = new Set<string>();

        category.values.forEach((categoryValue, index) => {
            valueColumns.forEach((valueColumn) => {
                const date = new Date(categoryValue.toString());
                const value = valueColumn.values[index] as number;
                const categoryName = valueColumn.source.groupName.toString();

                // Ensure valid date and value
                if (!isNaN(date.getTime()) && value !== null && value !== undefined && !isNaN(value)) {
                    dataPoints.push({
                        date: date,
                        value: value,
                        category: categoryName
                    });
                    categories.add(categoryName);
                }
            });
        });

        return {
            dataPoints,
            categories: Array.from(categories)
        };
    }

    private drawChart(data: VisualData) {
        const xScale = d3.scaleTime()
            .domain(d3.extent(data.dataPoints, d => d.date) as [Date, Date])
            .range([0, this.width]);

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(data.dataPoints, d => d.value) as number])
            .nice()
            .range([this.height, 0]);

        const colorScale = d3.scaleOrdinal(d3.schemeCategory10)
            .domain(data.categories);

        const line = d3.line<DataPoint>()
            .x(d => xScale(d.date))
            .y(d => yScale(d.value));

        const svg = this.svg.select<SVGGElement>('g');
        svg.selectAll('*').remove();

        svg.append('g')
            .attr('class', 'x axis')
            .attr('transform', `translate(0,${this.height})`)
            .call(d3.axisBottom(xScale));

        svg.append('g')
            .attr('class', 'y axis')
            .call(d3.axisLeft(yScale));

        const series = d3.group(data.dataPoints, d => d.category);

        series.forEach((dataPoints, category) => {
            svg.append('path')
                .datum(dataPoints)
                .attr('fill', 'none')
                .attr('stroke', colorScale(category) as string)
                .attr('stroke-width', 1.5)
                .attr('d', line);
        });
    }
}