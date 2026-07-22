"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = TrendWidget;
const react_1 = __importStar(require("react"));
const echarts_for_react_1 = __importDefault(require("echarts-for-react"));
const useStudioHmiSignal_1 = require("../hooks/useStudioHmiSignal");
const WidgetErrorOverlay_1 = __importDefault(require("./WidgetErrorOverlay"));
function TrendWidget({ label, signal, config, width, height, isPreview }) {
    const { value: rawValue, error, clearError } = (0, useStudioHmiSignal_1.useStudioHmiSignal)(isPreview ? signal : undefined);
    const history = config.history ?? 60;
    const chartColor = config.color ?? "#FFB800";
    const [data, setData] = (0, react_1.useState)([]);
    const counterRef = (0, react_1.useRef)(0);
    (0, react_1.useEffect)(() => {
        if (!isPreview || rawValue === null)
            return;
        counterRef.current++;
        const v = parseFloat(rawValue);
        if (isNaN(v))
            return;
        setData(prev => {
            const next = [...prev, { time: counterRef.current, value: v }];
            while (next.length > history)
                next.shift();
            return next;
        });
    }, [rawValue, history, isPreview]);
    const option = {
        backgroundColor: "transparent",
        grid: { top: 8, right: 8, bottom: 4, left: 8 },
        xAxis: {
            type: "category",
            show: false,
            data: data.map(d => d.time),
        },
        yAxis: { type: "value", show: false, min: "dataMin", max: "dataMax" },
        series: [{
                data: data.map(d => d.value),
                type: "line",
                smooth: false,
                lineStyle: { color: chartColor, width: 1.5 },
                areaStyle: { color: `${chartColor}20` },
                symbol: "none",
                animation: false,
            }],
        title: { text: label, left: "center", top: 2,
            textStyle: { color: "#a0a0b0", fontSize: 11, fontFamily: "Geist Sans" },
        },
    };
    return (react_1.default.createElement("div", { style: { width: "100%", height: "100%", position: "relative" } },
        react_1.default.createElement(echarts_for_react_1.default, { option: option, style: { width: "100%", height: "100%" }, notMerge: true }),
        isPreview && error && (react_1.default.createElement(WidgetErrorOverlay_1.default, { message: error, onDismiss: clearError }))));
}
//# sourceMappingURL=TrendWidget.js.map