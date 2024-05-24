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
import ISandboxExtendedColorPalette = powerbi.extensibility.ISandboxExtendedColorPalette;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataViewCategoryColumn = powerbi.DataViewCategoryColumn;
import Fill = powerbi.Fill;
import DataViewObjectPropertyIdentifier = powerbi.DataViewObjectPropertyIdentifier;
import { dataViewObjects } from "powerbi-visuals-utils-dataviewutils";
import { createTooltipServiceWrapper, ITooltipServiceWrapper } from "powerbi-visuals-utils-tooltiputils";

import { LineChartSettingsModel } from "./settings";

interface DataPoint {
    date: Date;
    value: number;
    category: string;
    color: string;
}

interface VisualData {
    dataPoints: DataPoint[];
    categories: string[];
    yScales: { [key: string]: d3.ScaleLinear<number, number> };
}

export class Visual implements IVisual {
    private svg: d3.Selection<SVGElement, unknown, HTMLElement, any>;
    private margin = { top: 20, right: 0, bottom: 30, left: 50 };
    private width: number;
    private height: number;
    private host: IVisualHost;
    private tooltipServiceWrapper: ITooltipServiceWrapper;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.tooltipServiceWrapper = createTooltipServiceWrapper(this.host.tooltipService, options.element);
        this.svg = d3.select(options.element)
            .append('svg')
            .classed('line-chart', true);

        this.svg.attr('width', this.width + this.margin.left + this.margin.right)
            .attr('height', this.height + this.margin.top + this.margin.bottom);

        this.svg.append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
    }

    public update(options: VisualUpdateOptions) {
        // Set the right margin to manage the number of categories (legend)   
        this.margin.right = 40 * options.dataViews[0].categorical.values.length

        this.width = options.viewport.width - this.margin.left - this.margin.right;
        this.height = options.viewport.height - this.margin.top - this.margin.bottom;


        const dataView: DataView = options.dataViews[0];
        const visualData = this.getVisualData(dataView, this.host);

        this.drawChart(visualData, this.host);

        console.log(visualData.dataPoints)

    }

    private getVisualData(dataView: DataView, host: IVisualHost): VisualData {
        const colorPalette: ISandboxExtendedColorPalette = host.colorPalette;


        const category = dataView.categorical.categories[0];
        const valueColumns = dataView.categorical.values;

        const dataPoints: DataPoint[] = [];
        const categories = new Set<string>();
        const yScales: { [key: string]: d3.ScaleLinear<number, number> } = {};

        category.values.forEach((categoryValue, index) => {

            valueColumns.forEach((valueColumn) => {
                const date = new Date(categoryValue.toString());
                const value = valueColumn.values[index] as number;
                const categoryName = valueColumn.source.groupName.toString();

                const color: string = colorPalette.getColor(categoryName).value


                if (!isNaN(date.getTime()) && value !== null && value !== undefined && !isNaN(value)) {
                    dataPoints.push({
                        date: date,
                        value: value,
                        category: categoryName,
                        color: color
                    });
                    categories.add(categoryName);
                }
            });
        });

        // Create yScales for each category
        categories.forEach(category => {
            const categoryDataPoints = dataPoints.filter(d => d.category === category);
            const yMax = d3.max(categoryDataPoints, d => d.value) as number;
            yScales[category] = d3.scaleLinear()
                .domain([0, yMax])
                .range([this.height, 0]);
        });

        return {
            dataPoints,
            categories: Array.from(categories),
            yScales
        };
    }

    private drawChart(data: VisualData, host: IVisualHost) {

        const colorPalette: ISandboxExtendedColorPalette = host.colorPalette;

        const xScale = d3.scaleTime()
            .domain(d3.extent(data.dataPoints, d => d.date) as [Date, Date])
            .range([0, this.width]);

        const colorScale = d3.scaleOrdinal(d3.schemeCategory10)
            .domain(data.categories);

        const line = d3.line<DataPoint>()
            .x(d => xScale(d.date))
            .y(d => {
                const yScale = data.yScales[d.category];
                return yScale(d.value);
            });

        const svg = this.svg.select<SVGGElement>('g');
        svg.selectAll('*').remove();

        svg.append('g')
            .attr('class', 'x axis')
            .attr('transform', `translate(0,${this.height})`)
            .call(d3.axisBottom(xScale));

        const series = d3.group(data.dataPoints, d => d.category);

        let axisOffset = 0;
        const axisSpacing = 40;

        const self = this;

        series.forEach((dataPoints, category) => {
            const yScale = data.yScales[category];

            console.log(category)

            // Draw the line
            svg.append('path')
                .datum(dataPoints)
                .attr('fill', 'none')
                .attr('stroke', colorPalette.getColor(category).value as string)
                .attr('stroke-width', 1.5)
                .attr('d', line);

            // Draw the points
            svg.selectAll(`.point-${category}`)
                .data(dataPoints)
                .enter()
                .append('circle')
                .attr('class', `point-${category}`)
                .attr('cx', d => xScale(d.date))
                .attr('cy', d => yScale(d.value))
                .attr('r', 3)
                .attr('fill', colorPalette.getColor(category).value as string)
                .each(function (d) {
                    // Utilisation de function pour conserver le contexte de 'this' 
                    self.tooltipServiceWrapper.addTooltip(d3.select(this), (tooltipEvent) => {
                        return [{
                            displayName: "Legend",
                            value: category
                        },
                        { displayName: "Measure", value: d.value.toString() }];
                    }, () => null, true);
                });

            svg.append('g')
                .attr('class', 'y axis')
                .attr('transform', `translate(${this.width + axisOffset}, 0)`)
                .call(d3.axisRight(yScale).tickSize(5).ticks(5))
                .append('text')
                .attr('fill', colorPalette.getColor(category).value as string)
                .attr('text-anchor', 'start')
                .attr('x', 10)
                .attr('y', -10)
                .text(category)

            axisOffset += axisSpacing;
        });
    }

}