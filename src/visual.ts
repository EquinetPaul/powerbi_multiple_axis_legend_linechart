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
import ISelectionId = powerbi.visuals.ISelectionId;
import IColorPalette = powerbi.extensibility.IColorPalette;
import DataViewValueColumns = powerbi.DataViewValueColumns;
import DataViewValueColumnGroup = powerbi.DataViewValueColumnGroup;
import DataViewObjectPropertyIdentifier = powerbi.DataViewObjectPropertyIdentifier;
import ILocalizationManager = powerbi.extensibility.ILocalizationManager;
import ISelectionManager = powerbi.extensibility.ISelectionManager;

import { createTooltipServiceWrapper, ITooltipServiceWrapper } from "powerbi-visuals-utils-tooltiputils";
import { ColorHelper } from "powerbi-visuals-utils-colorutils";
import { VisualFormattingSettingsModel } from "./settings";
import { dataViewObjects } from "powerbi-visuals-utils-dataviewutils";


// Represents an individual data point in the chart
interface DataPoint {
    date: Date;       // Date of the data point
    value: number;    // Numeric value of the data point
    category: string; // Category of the data point
    color: string;    // Color associated with the category
}

// Represents the visual data for the chart
interface VisualData {
    dataPoints: DataPoint[];                           // Array of data points
    categories: string[];                              // List of unique categories
    yScales: { [key: string]: d3.ScaleLinear<number, number> }; // Y-axis scales for each category
}

// Represents the series (used for selection)
export interface dataSerie {
    value: powerbi.PrimitiveValue;
    selection: ISelectionId,
    color: string;
    style: string;
    displayAxis: boolean
}

export class Visual implements IVisual {
    // Variables for SVG elements, dimensions, and settings
    private svg: d3.Selection<SVGElement, unknown, HTMLElement, any>;
    private margin = { top: 20, right: 0, bottom: 30, left: 50 };
    private width: number;
    private height: number;

    // Variables for visual management and formatting management 
    private host: IVisualHost;
    private tooltipServiceWrapper: ITooltipServiceWrapper;
    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;

    private colorPalette: IColorPalette;
    private localizationManager: ILocalizationManager;
    private selectionManager: ISelectionManager;

    // Constructor initializes the visual, sets up the SVG container, and applies initial settings
    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.formattingSettingsService = new FormattingSettingsService(this.localizationManager);
        this.tooltipServiceWrapper = createTooltipServiceWrapper(this.host.tooltipService, options.element);
        this.localizationManager = this.host.createLocalizationManager();
        this.colorPalette = options.host.colorPalette;
        this.selectionManager = this.host.createSelectionManager();
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
        this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(VisualFormattingSettingsModel, options.dataViews?.[0]);

        // Generate data for series
        const dataSeries: dataSerie[] = this.getSeriesData(options)
        this.formattingSettings.populateColorSelector(dataSeries);
        this.formattingSettings.populateStyleSelector(dataSeries);
        this.formattingSettings.populateAxisSelector(dataSeries);
        this.formattingSettings.hideAllAxis()

        // Adjust the right margin based on the number of categories  
        this.margin.right = 40 * countTrueBools(this.formattingSettings.axisSelector.slices)

        // Calculate width and height based on viewport and margins
        this.width = options.viewport.width - this.margin.left - this.margin.right;
        this.height = options.viewport.height - this.margin.top - this.margin.bottom;

        // Extract and process data from the DataView
        const dataView: DataView = options.dataViews[0];
        const visualData = this.getVisualData(dataView, this.host, this.formattingSettings);

        // Draw the chart with the processed data and formatting settings
        this.drawChart(visualData, this.host, this.formattingSettings, dataSeries)



    }

    private getSeriesData(options) {
        const dataSeries: dataSerie[] = [];

        const series: powerbi.DataViewValueColumnGroup[] = options.dataViews[0].categorical.values.grouped();

        const valueColumns: DataViewValueColumns = options.dataViews[0].categorical.values,
            grouped: DataViewValueColumnGroup[] = valueColumns.grouped(),
            defaultDataPointColor: string = "green",
            fillProp: DataViewObjectPropertyIdentifier = {
                objectName: "colorSelector",
                propertyName: "fill"
            },
            styleProp: DataViewObjectPropertyIdentifier = {
                objectName: "styleSelector",
                propertyName: "enumeration"
            };

        series.forEach((ser: powerbi.DataViewValueColumnGroup, index) => {

            // create selection id for series
            const seriesSelectionId = this.host.createSelectionIdBuilder()
                .withSeries(options.dataViews[0].categorical.values, ser)
                .createSelectionId();


            // get the color from series
            const defaultDataPointColor: string = this.colorPalette.getColor(ser.name.toString()).value;
            let colorHelper: ColorHelper = new ColorHelper(
                this.colorPalette,
                fillProp,
                defaultDataPointColor);
            let grouping: DataViewValueColumnGroup = grouped[index];
            let color = colorHelper.getColorForSeriesValue(grouping.objects, grouping.name);

            let style = "Line";
            if (grouping.objects && grouping.objects.styleSelector) {
                style = grouping.objects.styleSelector.enumeration.toString() || "Line";
            }

            let displayAxis = true;
            if (grouping.objects && grouping.objects.axisSelector) {
                displayAxis = grouping.objects.axisSelector.bool.toString() === "true"
            }

            // create the series elements
            dataSeries.push({
                value: ser.name,
                selection: seriesSelectionId,
                color: color,
                style: style,
                displayAxis: displayAxis
            });

        });

        return dataSeries

    }

    private getVisualData(dataView: DataView, host: IVisualHost, formattingSettings: VisualFormattingSettingsModel): VisualData {
        // Get color palette from host
        const colorPalette: ISandboxExtendedColorPalette = host.colorPalette;

        // Extract categories and value columns from dataView
        const category = dataView.categorical.categories[0];
        const valueColumns = dataView.categorical.values;

        // Initialize arrays and sets for data points and categories
        const dataPoints: DataPoint[] = [];
        const categories = new Set<string>();
        const yScales: { [key: string]: d3.ScaleLinear<number, number> } = {};

        // Iterate over each category value
        category.values.forEach((categoryValue, index) => {
            // Iterate over each value column
            valueColumns.forEach((valueColumn) => {
                const date = new Date(categoryValue.toString());
                const value = valueColumn.values[index] as number;
                const categoryName = valueColumn.source.groupName.toString();

                const color: string = colorPalette.getColor(categoryName).value

                // Check for valid date and value, then add to data points and categories
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

        // Create yScales for each category based on auto-scaling settings
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

        // Return processed visual data
        return {
            dataPoints,
            categories: Array.from(categories),
            yScales
        };
    }

    private drawChart(data: VisualData, host: IVisualHost, formattingSettings: VisualFormattingSettingsModel, dataSeries: dataSerie[]) {
        // Get color palette from host
        const colorPalette: ISandboxExtendedColorPalette = host.colorPalette;

        // Create xScale for time-based data
        // TODO: Manage different type of data (not just time-based)
        const xScale = d3.scaleTime()
            .domain(d3.extent(data.dataPoints, d => d.date) as [Date, Date])
            .range([0, this.width]);

        // Define the line generator function
        const line = d3.line<DataPoint>()
            .x(d => xScale(d.date))
            .y(d => {
                const yScale = data.yScales[d.category];
                return yScale(d.value);
            });

        // Clear previous chart elements
        const svg = this.svg.select<SVGGElement>('g');
        svg.selectAll('*').remove();

        // Append x-axis
        svg.append('g')
            .attr('class', 'x axis')
            .attr('transform', `translate(0,${this.height})`)
            .call(
                d3.axisBottom(xScale)
                    .ticks(Math.max(Math.floor(this.width / 100), 2))
                // .tickFormat(d3.timeFormat("%Y-%m-%d");)
            );

        // Group data points by category
        const series = d3.group(data.dataPoints, d => d.category);

        // Define spacings for Y axis
        let axisOffset = 0;
        const axisSpacing = 40;

        const self = this;

        series.forEach((dataPoints, category) => {
            const yScale = data.yScales[category];
            const dataSeriesItem = dataSeries.find(item => item.value === category);

            // Draw the line
            const path = svg.append('path')
                .datum(dataPoints)
                .attr('class', 'line')
                .attr('fill', 'none')
                .attr('stroke', dataSeriesItem.color)
                .attr('stroke-width', 1.5)
                .attr('d', line)
                .attr('category', category)
                .attr('opacity', dataSeriesItem.style === "Line" ? 1 : 0)
                .on('click', function (event, d) {
                    // Stop the click event from propagating to the svg background
                    // event.stopPropagation();
                    // highlightCategory(category);
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
                .attr('fill', dataSeriesItem.color)
                .attr('category', category)
                .attr('opacity', dataSeriesItem.style === "Line" ? 0 : 1)
                .on('mouseover', function (event, d) {
                    d3.select(this).attr('stroke', 'black').attr('stroke-width', 2);
                })
                .on('mouseout', function (event, d) {
                    d3.select(this).attr('stroke', null).attr('stroke-width', null);
                });

            // Only draw the axis if displayAxis is true
            if (dataSeriesItem.displayAxis) {
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
                        const multiSelect = (event as MouseEvent).ctrlKey;
                        self.selectionManager.select(dataSeries.find(item => item.value === category).selection, multiSelect);
                    });

                // Draw the y-axis
                svg.append('g')
                    .attr('class', 'y axis')
                    .attr('transform', `translate(${this.width + axisOffset}, 0)`)
                    .attr('data-category', category) // Add data-category attribute
                    .call(d3.axisRight(yScale)
                        .tickSize(5)
                        .ticks(5)
                        .tickFormat(d3.format('.2s')))  // Utilisation du formateur ici
                    .append('text')
                    .attr('fill', dataSeriesItem.color)
                    .attr('text-anchor', 'start')
                    .attr('x', 0)
                    .attr('y', -10)
                    .text(category.length > 6 ? category.substring(0, 4) + '..' : category);

                axisOffset += axisSpacing;
            }
        });


        // svg.selectAll('.y.axis')
        // .addEventListener("click", (mouseEvent) => {
        //     const multiSelect = (mouseEvent as MouseEvent).ctrlKey;
        //     this.selectionManager.select(seriesSelectionId, multiSelect);
        // });

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
        let tooltipTimeout;
        const overlay = svg.append('rect')
            .attr('class', 'overlay')
            .attr('width', this.width)
            .attr('height', this.height)
            .attr('fill', 'none')
            .attr('pointer-events', 'all')
            .on('mousemove', function (event) {
                clearTimeout(tooltipTimeout); // Clear any existing timeout

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
                        <circle cx="5" cy="5" r="5" fill="${dataSeries.find(item => item.value === d.category).color}" />
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

                    tooltipTimeout = setTimeout(() => {
                        tooltip.style("left", `${tooltipX}px`)
                            .style("top", `${event.pageY + 10}px`)
                            .style("opacity", 1);
                    }, 500); // Delay of 0.5 seconds
                } else {
                    verticalLine.attr('opacity', 0);
                    tooltip.style("opacity", 0);
                }
            })
            .on('mouseout', function () {
                clearTimeout(tooltipTimeout); // Clear the timeout if mouse leaves
                verticalLine.attr('opacity', 0);
                tooltip.style("opacity", 0);
                svg.selectAll('circle').classed('selected-point', false);
            });


        // Function to get the closest data points
        function getClosestDataPoints(mouseX) {
            // const bisectDate = d3.bisector((d: DataPoint) => d.date.getTime()).left;
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

            closestPoints.forEach(d => {
                svg.selectAll(`.point-${d.category}`).filter(function (dp: DataPoint) { return dp.date.getTime() === d.date.getTime(); })
                    .classed('selected-point', true);
            });

            return closestPoints;
        }

        // Function to highlight category
        function highlightCategory(category) {
            // Reduce the opacity of all lines and points
            svg.selectAll('path.line').attr('opacity', function () {
                const dataSeriesItem = dataSeries.find(item => item.value === d3.select(this).attr('category'));
                return dataSeriesItem && dataSeriesItem.style === "Line" ? 0.2 : 0;
            });
            svg.selectAll('circle').attr('opacity', function () {
                const dataSeriesItem = dataSeries.find(item => item.value === d3.select(this).attr('category'));
                return dataSeriesItem && dataSeriesItem.style === "Point" ? 0.2 : 0;
            });

            // Highlight the selected line or its points
            const selectedDataSeriesItem = dataSeries.find(item => item.value === category);
            if (selectedDataSeriesItem.style === "Line") {
                svg.selectAll('path.line').filter(function () {
                    return d3.select(this).attr('category') === category;
                }).attr('opacity', 1);
            } else if (selectedDataSeriesItem.style === "Point") {
                svg.selectAll(`.point-${category}`).attr('opacity', 1);
            }
        }



        // Function to reset opacity
        function resetOpacity() {
            svg.selectAll('path.line').attr('opacity', function () {
                const dataSeriesItem = dataSeries.find(item => item.value === d3.select(this).attr('category'));
                return dataSeriesItem && dataSeriesItem.style === "Line" ? 1 : 0;
            });
            svg.selectAll('circle').attr('opacity', function () {
                const dataSeriesItem = dataSeries.find(item => item.value === d3.select(this).attr('category'));
                return dataSeriesItem && dataSeriesItem.style === "Point" ? 1 : 0;
            });
        }
    }


    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }

}

function countTrueBools(arr) {
    return arr.filter(item => item.name === "bool" && item.value === true).length;
}