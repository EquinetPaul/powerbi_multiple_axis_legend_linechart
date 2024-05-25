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
import { VisualFormattingSettingsModel } from "./settings";


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
    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.formattingSettingsService = new FormattingSettingsService();
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
        // Get formating settings
        this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(VisualFormattingSettingsModel, options.dataViews[0]);

        // Set the right margin to manage the number of categories (legend)   
        this.margin.right = 40 * options.dataViews[0].categorical.values.length

        this.width = options.viewport.width - this.margin.left - this.margin.right;
        this.height = options.viewport.height - this.margin.top - this.margin.bottom;


        const dataView: DataView = options.dataViews[0];
        const visualData = this.getVisualData(dataView, this.host, this.formattingSettings);

        this.drawChart(visualData, this.host, this.formattingSettings);

    }

    private getVisualData(dataView: DataView, host: IVisualHost, formattingSettings: VisualFormattingSettingsModel): VisualData {
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
        const yMinUserField = formattingSettings.generalSettings.minRangeY.value
        const yMaxUserField = formattingSettings.generalSettings.maxRangeY.value
        if (formattingSettings.generalSettings.autoScaleY.value) {
            formattingSettings.hideInputFieldsAxisY()
        }
        else {
            formattingSettings.displayInputFieldsAxisY()
        }
        categories.forEach(category => {
            const categoryDataPoints = dataPoints.filter(d => d.category === category);
            const yMin = d3.min(categoryDataPoints, d => d.value) as number;
            const yMax = d3.max(categoryDataPoints, d => d.value) as number;
            const yDomain = formattingSettings.generalSettings.autoScaleY.value ? [yMin, yMax] : [yMinUserField, yMaxUserField];
            yScales[category] = d3.scaleLinear()
                .domain(yDomain)
                .range([this.height, 0]);
        });

        return {
            dataPoints,
            categories: Array.from(categories),
            yScales
        };
    }

    private drawChart(data: VisualData, host: IVisualHost, formattingSettings: VisualFormattingSettingsModel) {
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

            // Draw the line
            const path = svg.append('path')
                .datum(dataPoints)
                .attr('class', 'line')
                .attr('fill', 'none')
                .attr('stroke', colorPalette.getColor(category).value as string)
                .attr('stroke-width', 1.5)
                .attr('d', line)
                .on('click', function (event, d) {
                    // Stop the click event from propagating to the svg background
                    event.stopPropagation();
                    highlightCategory(category);
                });

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
                .attr('opacity', formattingSettings.generalSettings.displayPoints.value ? 1 : 0)
                .on('mouseover', function (event, d) {
                    d3.select(this).attr('stroke', 'black').attr('stroke-width', 2);
                })
                .on('mouseout', function (event, d) {
                    d3.select(this).attr('stroke', null).attr('stroke-width', null);
                });

            // Add background rectangle for the axis
            svg.append('rect')
                .attr('class', 'axis-background')
                .attr('x', this.width + axisOffset)
                .attr('y', 0)
                .attr('width', axisSpacing)
                .attr('height', this.height)
                .attr('fill', 'transparent')
                .attr('pointer-events', 'all')
                .attr('data-category', category)
                .on('mouseover', function () {
                    d3.select(this).attr('fill', '#f0f0f0');
                })
                .on('mouseout', function () {
                    d3.select(this).attr('fill', 'transparent');
                })
                .on('click', function (event) {
                    event.stopPropagation();
                    const category = d3.select(this).attr('data-category');
                    highlightCategory(category);
                });

            // Draw the axis
            svg.append('g')
                .attr('class', 'y axis')
                .attr('transform', `translate(${this.width + axisOffset}, 0)`)
                .attr('data-category', category) // Add data-category attribute
                .call(d3.axisRight(yScale)
                    .tickSize(5)
                    .ticks(5)
                    .tickFormat(d3.format('.2s')))  // Utilisation du formateur ici
                .append('text')
                .attr('fill', colorPalette.getColor(category).value as string)
                .attr('text-anchor', 'start')
                .attr('x', 10)
                .attr('y', -10)
                .text(category);

            axisOffset += axisSpacing;
        });

        // Add click event to axes for highlighting
        svg.selectAll('.y.axis')
            .on('click', function (event) {
                event.stopPropagation();
                const category = d3.select(this).attr('data-category');
                highlightCategory(category);
            });

        // Click event on the background to reset opacity
        this.svg.on('click', function () {
            resetOpacity();
        });

        // Add a vertical line for the mouse hover
        const verticalLine = svg.append('line')
            .attr('class', 'vertical-line')
            .attr('y1', 0)
            .attr('y2', this.height)
            .attr('stroke', 'black')
            .attr('stroke-width', 1)
            .attr('opacity', 0);

        // Add a div for the custom tooltip
        const tooltip = d3.select("body").append("div")
            .attr("class", "custom-tooltip")
            .style("position", "absolute")
            .style("padding", "10px")
            .style("background", "rgba(0, 0, 0, 0.7)")
            .style("color", "#fff")
            .style("border-radius", "5px")
            .style("pointer-events", "none")
            .style("opacity", 0);

        // Overlay to capture mouse movements
        const overlay = svg.append('rect')
            .attr('class', 'overlay')
            .attr('width', this.width)
            .attr('height', this.height)
            .attr('fill', 'none')
            .attr('pointer-events', 'all')
            .on('mousemove', function (event) {
                const [mouseX] = d3.pointer(event);
                const closestDataPoints = getClosestDataPoints(mouseX);
                if (closestDataPoints.length > 0) {
                    const date = closestDataPoints[0].date;
                    verticalLine
                        .attr('x1', xScale(date))
                        .attr('x2', xScale(date))
                        .attr('opacity', 1);

                    // Update tooltip content
                    const tooltipContent = closestDataPoints.map(d =>
                        `<div style="display: flex; align-items: center;">
                            <svg width="10" height="10" style="margin-right: 5px;">
                                <circle cx="5" cy="5" r="5" fill="${colorPalette.getColor(d.category).value as string}" />
                            </svg>
                            ${d.category}: ${d.value}
                        </div>`
                    ).join("");

                    tooltip.html(`<div><strong>${closestDataPoints[0].date.toDateString()}</strong></div>${tooltipContent}`);

                    // Calculate tooltip position
                    const tooltipWidth = tooltip.node().getBoundingClientRect().width;
                    const windowWidth = window.innerWidth;
                    let tooltipX = event.pageX + 10;  // Default position to the right
                    if (tooltipX + tooltipWidth > windowWidth) {
                        tooltipX = event.pageX - tooltipWidth - 10;  // Position to the left if it exceeds window width
                    }

                    tooltip.style("left", `${tooltipX}px`)
                        .style("top", `${event.pageY + 10}px`)
                        .style("opacity", 1);
                } else {
                    verticalLine.attr('opacity', 0);
                    tooltip.style("opacity", 0);
                }
            })
            .on('mouseout', function () {
                verticalLine.attr('opacity', 0);
                tooltip.style("opacity", 0);
            });

        // Function to get the closest data points
        function getClosestDataPoints(mouseX) {
            const bisectDate = d3.bisector((d: DataPoint) => d.date.getTime()).left;
            const x0 = xScale.invert(mouseX).getTime();
            let closestPoints = [];
            let minDiff = Infinity;
            data.dataPoints.forEach(d => {
                const diff = Math.abs(d.date.getTime() - x0);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestPoints = [d];
                } else if (diff === minDiff) {
                    closestPoints.push(d);
                }
            });

            svg.selectAll('circle').classed('selected-point', false);

            console.log(closestPoints)

            closestPoints.forEach(d => {
                svg.selectAll(`.point-${d.category}`).filter(function (dp: DataPoint) { return dp.date.getTime() === d.date.getTime(); })
                    .classed('selected-point', true);
            });

            return closestPoints;
        }

        // Function to highlight category
        function highlightCategory(category) {
            // Reduce the opacity of all lines and points
            svg.selectAll('path.line').attr('opacity', 0.2);
            svg.selectAll('circle').attr('opacity', formattingSettings.generalSettings.displayPoints.value ? 0.2 : 0);

            // Highlight the selected line and its points
            svg.selectAll(`path.line`).filter(function (d) { return d[0].category === category; }).attr('opacity', 1);
            svg.selectAll(`.point-${category}`).attr('opacity', formattingSettings.generalSettings.displayPoints.value ? 1 : 0);
        }

        // Function to reset opacity
        function resetOpacity() {
            svg.selectAll('path.line').attr('opacity', 1);
            svg.selectAll('circle').attr('opacity', formattingSettings.generalSettings.displayPoints.value ? 1 : 0);
        }
    }


    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }

}