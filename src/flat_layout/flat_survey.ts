import { IElement, IQuestion, PanelModelBase, PanelModel, QuestionRowModel } from 'survey-core';
import { SurveyPDF } from '../survey';
import { IPoint, DocController } from "../doc_controller";
import { FlatRepository } from './flat_repository';
import { IFlatQuestion } from './flat_question';
import { IPdfBrick } from '../pdf_render/pdf_brick';
import { CompositeBrick } from '../pdf_render/pdf_composite';
import { RowlineBrick } from '../pdf_render/pdf_rowline';
import { SurveyHelper } from '../helper_survey';

export class FlatSurvey {
    static parseWidth(width: string): number {
        return parseFloat(width) / 100.0;
    }
    public static async  generateFlatsPanel(point: IPoint,
        question: PanelModel, controller: DocController): Promise<IPdfBrick[]> {
        let panelFlats: IPdfBrick[] = new Array<IPdfBrick>();
        let panelContentPoint: IPoint = { xLeft: point.xLeft, yTop: point.yTop };
        if (!!question.title) {
            let panelTitleFlat: IPdfBrick = await SurveyHelper.createTitlePanelFlat(
                panelContentPoint, null, controller, question.title);
            let compositeFlat: CompositeBrick = new CompositeBrick(panelTitleFlat);
            panelContentPoint = SurveyHelper.createPoint(panelTitleFlat);
            if (!!question.description) {
                let panelDescFlat: IPdfBrick = await SurveyHelper.createDescFlat(
                    panelContentPoint, null, controller,
                    SurveyHelper.getLocString(question.locDescription));
                compositeFlat.addBrick(panelDescFlat);
                panelContentPoint = SurveyHelper.createPoint(panelDescFlat);
            }
            panelFlats.push(compositeFlat);
        }
        let oldPanelMarginLeft: number = controller.margins.left;
        controller.margins.left += SurveyHelper.measureText(question.innerIndent).width;
        panelContentPoint.xLeft += SurveyHelper.measureText(question.innerIndent).width;
        panelFlats.push(...await this.generateFlatsPagePanel(panelContentPoint, question, controller));
        controller.margins.left = oldPanelMarginLeft;
        return panelFlats;
    }
    private static async  generateFlatsPagePanel(point: IPoint,
        pagePanel: PanelModelBase, controller: DocController): Promise<IPdfBrick[]> {
        if (!pagePanel.isVisible) return;
        pagePanel.onFirstRendering();
        let pagePanelFlats: IPdfBrick[] = new Array<IPdfBrick>();
        let currPoint: IPoint = SurveyHelper.clone(point);
        for (let row of pagePanel.rows) {
            if (!row.visible) return;
            let width: number = SurveyHelper.getPageAvailableWidth(controller);
            let oldMarginLeft: number = controller.margins.left;
            let oldMarginRight: number = controller.margins.right;
            let currMarginLeft: number = controller.margins.left;
            let rowFlats: IPdfBrick[] = new Array();
            for (let question of row.elements) {
                let persWidth: number = width * FlatSurvey.parseWidth(question.renderWidth);
                controller.margins.left = currMarginLeft;
                controller.margins.right = controller.paperWidth -
                    currMarginLeft - persWidth;
                currMarginLeft = controller.paperWidth - controller.margins.right;
                currPoint.xLeft = controller.margins.left;
                if (question instanceof PanelModel) {
                    rowFlats.push(...await this.generateFlatsPanel(currPoint, question, controller));
                }
                else {
                    let flatQuestion: IFlatQuestion =
                        FlatRepository.getInstance().create(<IQuestion>question, controller);
                    rowFlats.push(...await flatQuestion.generateFlats(currPoint));
                }

            }
            controller.margins.left = oldMarginLeft;
            controller.margins.right = oldMarginRight;
            currPoint.xLeft = controller.margins.left;
            if (rowFlats.length !== 0) {
                currPoint.yTop = SurveyHelper.mergeRects(...rowFlats).yBot;
                currPoint.yTop += SurveyHelper.measureText().height;
                pagePanelFlats.push(...rowFlats);
                pagePanelFlats.push(SurveyHelper.createRowlineFlat(currPoint, controller));
                currPoint.yTop += SurveyHelper.EPSILON;
            }
        }
        pagePanel.rows.forEach((row: QuestionRowModel) => {

        });
        return pagePanelFlats;
    }
    private static popRowlines(flats: IPdfBrick[]) {
        while (flats.length > 0 && flats[flats.length - 1] instanceof RowlineBrick) {
            flats.pop();
        }
    }
    static async generateFlats(survey: SurveyPDF): Promise<IPdfBrick[][]> {
        let flats: IPdfBrick[][] = new Array<IPdfBrick[]>();
        for (let page of survey.pages) {
            let pageFlats: IPdfBrick[] = new Array<IPdfBrick>();
            pageFlats.push(...await this.generateFlatsPagePanel(
                survey.controller.leftTopPoint, page, survey.controller));
            flats.push(pageFlats);
            this.popRowlines(flats[flats.length - 1]);
        }
        return flats;
    }
}