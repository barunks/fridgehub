"""Shopping report PDF generation with FamilyHub watermark."""

from io import BytesIO
from datetime import date

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.pdfgen.canvas import Canvas
from sqlalchemy.orm import Session

from app.models import Family, GroceryItem, GroceryListType, GroceryPurchaseCycle, GrocerySubList


class _WatermarkCanvas(Canvas):
    """Canvas subclass that draws a diagonal FamilyHub watermark on every page."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._family_name: str = "FamilyHub"

    def showPage(self):
        self._draw_watermark()
        super().showPage()

    def _draw_watermark(self):
        self.saveState()
        self.setFont("Helvetica-Bold", 52)
        self.setFillColor(colors.Color(0.85, 0.85, 0.85, alpha=0.3))
        self.translate(A4[0] / 2, A4[1] / 2)
        self.rotate(45)
        self.drawCentredString(0, 0, f"FamilyHub")
        self.restoreState()


def generate_shopping_report(
    db: Session,
    family_id: int,
    *,
    list_type_id: int | None = None,
    list_type_ids: list[int] | None = None,
    frequency: str | None = None,
    stock_filter: str | None = None,
    stock_filters: list[str] | None = None,
    item_name: str | None = None,
    item_names: list[str] | None = None,
    only_needed: bool = False,
) -> bytes:
    """Generate a filtered shopping report PDF and return raw bytes."""

    family = db.get(Family, family_id)
    family_name = family.family_name if family else "Family"

    # Query active shopping items from current cycles
    query = (
        db.query(GrocerySubList)
        .join(GroceryPurchaseCycle, GrocerySubList.purchase_cycle_id == GroceryPurchaseCycle.id)
        .join(GroceryItem, GrocerySubList.item_id == GroceryItem.id)
        .join(GroceryListType, GroceryPurchaseCycle.list_type_id == GroceryListType.id)
        .filter(
            GroceryPurchaseCycle.family_id == family_id,
            GroceryPurchaseCycle.is_completed.is_(False),
            GroceryListType.is_active.is_(True),
            GroceryItem.is_active.is_(True),
        )
    )

    selected_list_type_ids = list_type_ids or ([list_type_id] if list_type_id else [])
    selected_stock_filters = stock_filters or ([stock_filter] if stock_filter else [])
    selected_item_names = item_names or ([item_name] if item_name else [])

    if selected_list_type_ids:
        query = query.filter(GroceryPurchaseCycle.list_type_id.in_(selected_list_type_ids))
    elif list_type_id:
        query = query.filter(GroceryPurchaseCycle.list_type_id == list_type_id)
    if frequency:
        query = query.filter(GroceryPurchaseCycle.frequency == frequency)
    if selected_stock_filters and set(selected_stock_filters) != {"yes", "no"}:
        if "yes" in selected_stock_filters:
            query = query.filter(GrocerySubList.is_purchased.is_(True))
        elif "no" in selected_stock_filters:
            query = query.filter(GrocerySubList.is_purchased.is_(False))
    if selected_item_names:
        query = query.filter(GroceryItem.item_name.in_(selected_item_names))
    elif item_name:
        query = query.filter(GroceryItem.item_name == item_name)
    if only_needed:
        query = query.filter(GrocerySubList.is_purchased.is_(False))

    rows = query.order_by(GroceryPurchaseCycle.list_type_id, GrocerySubList.id).all()

    # Build PDF
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Heading1"],
        fontSize=18,
        spaceAfter=4 * mm,
        textColor=colors.HexColor("#1e293b"),
    )
    subtitle_style = ParagraphStyle(
        "ReportSubtitle",
        parent=styles["Normal"],
        fontSize=10,
        textColor=colors.HexColor("#64748b"),
        spaceAfter=6 * mm,
    )

    elements: list = []
    elements.append(Paragraph(f"{family_name} — Shopping Report", title_style))

    # Filter summary
    filters_applied = []
    if selected_list_type_ids:
        names = [
            row.list_name
            for row in db.query(GroceryListType)
            .filter(GroceryListType.id.in_(selected_list_type_ids))
            .order_by(GroceryListType.list_name)
            .all()
        ]
        if names:
            filters_applied.append(f"Place: {', '.join(names)}")
    if frequency:
        filters_applied.append(f"Frequency: {frequency}")
    if selected_stock_filters and set(selected_stock_filters) != {"yes", "no"}:
        labels = ["Purchased" if value == "yes" else "Not purchased" for value in selected_stock_filters]
        filters_applied.append(f"Status: {', '.join(labels)}")
    if selected_item_names:
        filters_applied.append(f"Item: {', '.join(selected_item_names)}")
    if only_needed:
        filters_applied.append("Only items needed")

    filter_text = " | ".join(filters_applied) if filters_applied else "All items (no filters)"
    elements.append(Paragraph(f"Generated: {date.today().isoformat()}  •  Filters: {filter_text}", subtitle_style))

    if not rows:
        elements.append(Spacer(1, 10 * mm))
        elements.append(Paragraph("No items match the selected filters.", styles["Normal"]))
    else:
        # Table header
        table_data = [["#", "Item", "Place", "Qty", "Unit", "Bought", "Status"]]

        for idx, sub_item in enumerate(rows, 1):
            item = sub_item.item
            cycle = sub_item.purchase_cycle
            list_type = cycle.list_type if cycle else None
            place_name = list_type.list_name if list_type else "-"
            status = "Done" if sub_item.is_purchased else ("Partial" if float(sub_item.purchased_quantity or 0) > 0 else "Open")
            table_data.append([
                str(idx),
                item.item_name if item else "-",
                place_name,
                f"{sub_item.quantity:.1f}" if sub_item.quantity else "-",
                sub_item.unit or "-",
                f"{sub_item.purchased_quantity:.1f}" if sub_item.purchased_quantity else "0",
                status,
            ])

        col_widths = [25, 140, 90, 45, 45, 50, 50]
        table = Table(table_data, colWidths=col_widths, repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4f46e5")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 9),
            ("FONTSIZE", (0, 1), (-1, -1), 8),
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("ALIGN", (3, 0), (5, -1), "CENTER"),
            ("ALIGN", (6, 0), (6, -1), "CENTER"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#e2e8f0")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(table)

        # Summary
        total = len(rows)
        purchased = sum(1 for r in rows if r.is_purchased)
        elements.append(Spacer(1, 6 * mm))
        elements.append(Paragraph(
            f"<b>Total items:</b> {total}  |  <b>Purchased:</b> {purchased}  |  <b>Remaining:</b> {total - purchased}",
            styles["Normal"],
        ))

    doc.build(elements, canvasmaker=_WatermarkCanvas)
    return buffer.getvalue()
