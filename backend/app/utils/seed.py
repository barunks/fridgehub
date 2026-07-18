from datetime import timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models import (
    Announcement,
    EmergencyContact,
    Family,
    FamilyMember,
    FrequencyType,
    GroceryItem,
    GroceryListType,
    GroceryPurchaseCycle,
    GrocerySubList,
    GroceryType,
    MealPlan,
    MealPlanTemplate,
    Notification,
    Recipe,
    Task,
    User,
)
from app.utils.dates import cycle_end, date_offset, datetime_offset, start_of_week


MEAL_NAMES = {
    "Monday": {
        "breakfast": "Walnut Oatmeal and Yogurt",
        "lunch": "Pesto Turkey Sandwich",
        "snacks": "Salmon with Brown Rice and Spinach",
        "dinner": "Gelatin, Espresso and Fresh Fruit",
    },
    "Tuesday": {
        "breakfast": "Greek Yogurt with Berries",
        "lunch": "Pasta with Salmon and Peachy Salad",
        "snacks": "Veggie Burger and Corn on the Cob",
        "dinner": "Carrots and Salsa, Cheese and an Apple",
    },
    "Wednesday": {
        "breakfast": "Egg 'n' English Muffin",
        "lunch": "Couscous Lentil Salad",
        "snacks": "Turkey Stir-fry with Quinoa",
        "dinner": "Mango, Cottage Cheese and Yogurt",
    },
    "Thursday": {
        "breakfast": "Cottage Cheese and Tomato",
        "lunch": "Tuna and Bulgur Salad",
        "snacks": "Grilled Chicken and Baked Potato",
        "dinner": "Latte, Banana, Lemonade and Popcorn",
    },
    "Friday": {
        "breakfast": "Breakfast Muffin Crostini",
        "lunch": "Tuna Pasta Salad",
        "snacks": "Steak, Sweet Potato and Veggies",
        "dinner": "Yogurt, Strawberries and Olives",
    },
    "Saturday": {
        "breakfast": "Cereal with Blueberries",
        "lunch": "Turkey and Avocado Roll",
        "snacks": "Chicken and Beet Salad",
        "dinner": "Apricots and Ice Cream",
    },
    "Sunday": {
        "breakfast": "Eggs with Mushrooms and Bacon",
        "lunch": "Broccoli-Cheese Baked Potato",
        "snacks": "Pork with Pasta and Green Beans",
        "dinner": "Pear, Celery, Latte and Grapes",
    },
}

DAY_COLORS = {
    "Monday": "bg-rose-500",
    "Tuesday": "bg-orange-500",
    "Wednesday": "bg-yellow-500",
    "Thursday": "bg-green-500",
    "Friday": "bg-sky-500",
    "Saturday": "bg-blue-500",
    "Sunday": "bg-indigo-500",
}


def seed_demo_data(db: Session) -> None:
    if db.query(Family).first():
        return

    # Acquire advisory lock to prevent race between multiple workers
    from sqlalchemy import text as _text
    try:
        dialect = db.get_bind().dialect.name
    except Exception:
        dialect = "sqlite"
    if dialect == "postgresql":
        db.execute(_text("SELECT pg_advisory_lock(123456789)"))
        # Re-check after acquiring lock
        if db.query(Family).first():
            db.execute(_text("SELECT pg_advisory_unlock(123456789)"))
            return

    users = [
        User(
            email="meera@fridgehub.local",
            username="meera",
            password_hash=hash_password("fridgehub"),
            full_name="Meera",
            family_role="Mom",
            phone="+6591000001",
            email_verified=True,
            phone_verified=True,
        ),
        User(
            email="dad@fridgehub.local",
            username="dad",
            password_hash=hash_password("fridgehub"),
            full_name="Dad",
            family_role="Parent",
            phone="+6591000002",
            email_verified=True,
            phone_verified=True,
        ),
        User(
            email="ava@fridgehub.local",
            username="ava",
            password_hash=hash_password("fridgehub"),
            full_name="Ava",
            family_role="Child",
            phone="+6591000003",
            email_verified=True,
            phone_verified=True,
        ),
        User(
            email="noah@fridgehub.local",
            username="noah",
            password_hash=hash_password("fridgehub"),
            full_name="Noah",
            family_role="Child",
            phone="+6591000004",
            email_verified=True,
            phone_verified=True,
        ),
    ]
    db.add_all(users)
    db.flush()

    family = Family(
        family_name="FridgeHub",
        home_base="Singapore",
        timezone="Asia/Singapore",
        created_by=users[0].id,
        contact_email="family@fridgehub.local",
        contact_phone="+6500000000",
        pincode="018956",
        email_verified=True,
        phone_verified=True,
    )
    db.add(family)
    db.flush()

    members = [
        FamilyMember(
            family_id=family.id,
            user_id=users[0].id,
            role="Mom",
            initial="M",
            color_class="bg-pink-500",
            status="Coordinating meals",
            points=128,
            dietary_notes=["vegetarian dinners twice a week"],
        ),
        FamilyMember(
            family_id=family.id,
            user_id=users[1].id,
            role="Parent",
            initial="D",
            color_class="bg-blue-500",
            status="Medication reminder due",
            points=93,
        ),
        FamilyMember(
            family_id=family.id,
            user_id=users[2].id,
            role="Child",
            initial="A",
            color_class="bg-emerald-500",
            status="School event today",
            points=76,
            dietary_notes=["no peanuts"],
        ),
        FamilyMember(
            family_id=family.id,
            user_id=users[3].id,
            role="Child",
            initial="N",
            color_class="bg-amber-400",
            status="Soccer practice at 5 PM",
            points=64,
        ),
    ]
    db.add_all(members)

    existing_frequencies = {row.frequency_name for row in db.query(FrequencyType).all()}
    db.add_all(
        [
            FrequencyType(frequency_name=name, days_interval=days, display_order=display_order)
            for name, days, display_order in (
                ("daily", 1, 1),
                ("weekly", 7, 2),
                ("monthly", 30, 3),
                ("quarterly", 90, 4),
                ("semi_annually", 182, 5),
                ("yearly", 365, 6),
            )
            if name not in existing_frequencies
        ]
    )

    db.add_all(
        [
            GroceryType(type_name="Wet Market", description="Fresh produce market", icon="basket", color="#FF6B6B", is_system=True),
            GroceryType(type_name="Super Market", description="Large supermarket", icon="store", color="#4ECDC4", is_system=True),
            GroceryType(type_name="Murugan", description="Murugan store", icon="bag", color="#45B7D1", is_system=True),
            GroceryType(type_name="NTUC", description="NTUC FairPrice", icon="cart", color="#F9A825", is_system=True),
        ]
    )

    list_types = [
        GroceryListType(
            list_name="Wet Market",
            list_type="standard",
            description="Fresh produce, fish, greens, and herbs",
            color_class="bg-rose-500",
            family_id=family.id,
            created_by=users[0].id,
        ),
        GroceryListType(
            list_name="Super Market",
            list_type="standard",
            description="Packaged groceries and household supplies",
            color_class="bg-teal-500",
            family_id=family.id,
            created_by=users[0].id,
        ),
        GroceryListType(
            list_name="Murugan",
            list_type="standard",
            description="Indian pantry staples and spices",
            color_class="bg-sky-500",
            family_id=family.id,
            created_by=users[0].id,
        ),
        GroceryListType(
            list_name="NTUC",
            list_type="standard",
            description="Weekly supermarket run",
            color_class="bg-amber-500",
            family_id=family.id,
            created_by=users[0].id,
        ),
    ]
    db.add_all(list_types)
    db.flush()

    grocery_items = [
        GroceryItem(
            item_number="GRC-0001",
            item_name="Milk",
            list_type_id=list_types[3].id,
            quantity=Decimal("2.00"),
            unit="Lt",
            purchase_frequency="weekly",
            current_stock=False,
            start_date=date_offset(-10),
            expiry_date=date_offset(1),
            notes="Buy lactose-free if available",
            family_id=family.id,
            created_by=users[0].id,
        ),
        GroceryItem(
            item_number="GRC-0002",
            item_name="Spinach",
            list_type_id=list_types[0].id,
            quantity=Decimal("500.00"),
            unit="g",
            purchase_frequency="weekly",
            current_stock=False,
            start_date=date_offset(-7),
            expiry_date=date_offset(1),
            notes="Use in veggie pasta",
            family_id=family.id,
            created_by=users[0].id,
        ),
        GroceryItem(
            item_number="GRC-0003",
            item_name="Rice",
            list_type_id=list_types[2].id,
            quantity=Decimal("5.00"),
            unit="Kg",
            purchase_frequency="monthly",
            current_stock=False,
            start_date=date_offset(-20),
            notes="Pantry low",
            family_id=family.id,
            created_by=users[0].id,
        ),
        GroceryItem(
            item_number="GRC-0004",
            item_name="Tomato",
            list_type_id=list_types[0].id,
            quantity=Decimal("1.00"),
            unit="Kg",
            purchase_frequency="weekly",
            current_stock=True,
            start_date=date_offset(-5),
            expiry_date=date_offset(3),
            notes="For cottage cheese lunch",
            family_id=family.id,
            created_by=users[0].id,
        ),
        GroceryItem(
            item_number="GRC-0005",
            item_name="Dish soap",
            list_type_id=list_types[1].id,
            quantity=Decimal("1.00"),
            unit="Unit",
            purchase_frequency="monthly",
            current_stock=True,
            start_date=date_offset(-30),
            notes="Eco refill pouch",
            family_id=family.id,
            created_by=users[0].id,
        ),
        GroceryItem(
            item_number="GRC-0006",
            item_name="Yogurt",
            list_type_id=list_types[3].id,
            quantity=Decimal("6.00"),
            unit="Cups",
            purchase_frequency="weekly",
            current_stock=True,
            start_date=date_offset(-6),
            expiry_date=date_offset(4),
            notes="Breakfast and Friday dinner",
            family_id=family.id,
            created_by=users[0].id,
        ),
    ]
    db.add_all(grocery_items)
    db.flush()

    for list_type_id, frequency in sorted({(item.list_type_id, item.purchase_frequency) for item in grocery_items}):
        cycle = GroceryPurchaseCycle(
            list_type_id=list_type_id,
            frequency=frequency,
            cycle_start_date=date_offset(0),
            cycle_end_date=cycle_end(date_offset(0), frequency),
            family_id=family.id,
        )
        db.add(cycle)
        db.flush()

        for item in [item for item in grocery_items if item.list_type_id == list_type_id and item.purchase_frequency == frequency]:
            db.add(
                GrocerySubList(
                    purchase_cycle_id=cycle.id,
                    item_id=item.id,
                    quantity=item.quantity,
                    unit=item.unit,
                    is_purchased=item.current_stock and item.item_name == "Tomato",
                    purchased_quantity=item.quantity if item.current_stock and item.item_name == "Tomato" else Decimal("0.00"),
                    notes=item.notes,
                )
            )

    db.add_all(
        [
            Task(
                title="Medication",
                description="Dad morning medication",
                priority="high",
                status="pending",
                due_date=datetime_offset(0, 8),
                reminder_date=datetime_offset(0, 7, 45),
                recurrence_type="daily",
                recurrence_interval=1,
                family_id=family.id,
                assigned_to=users[1].id,
                created_by=users[0].id,
                category="health",
                action_label="Due soon",
            ),
            Task(
                title="School event",
                description="Ava class presentation",
                priority="high",
                status="in_progress",
                due_date=datetime_offset(0, 10, 30),
                reminder_date=datetime_offset(0, 9, 30),
                recurrence_type="none",
                recurrence_interval=1,
                family_id=family.id,
                assigned_to=users[2].id,
                created_by=users[0].id,
                category="school",
                action_label="22 min drive",
            ),
            Task(
                title="Electricity bill",
                description="Pay SP utilities bill",
                priority="medium",
                status="pending",
                due_date=datetime_offset(0, 17),
                reminder_date=datetime_offset(0, 15),
                recurrence_type="monthly",
                recurrence_interval=1,
                family_id=family.id,
                assigned_to=users[0].id,
                created_by=users[0].id,
                category="bill",
                action_label="Pay now",
            ),
            Task(
                title="Soccer practice",
                description="Noah training session",
                priority="medium",
                status="pending",
                due_date=datetime_offset(0, 17),
                reminder_date=datetime_offset(0, 16),
                recurrence_type="weekly",
                recurrence_interval=1,
                family_id=family.id,
                assigned_to=users[3].id,
                created_by=users[0].id,
                category="activity",
                action_label="Weather risk",
            ),
            Task(
                title="Parent-teacher meeting",
                description="Bring progress notes",
                priority="medium",
                status="pending",
                due_date=datetime_offset(1, 9),
                reminder_date=datetime_offset(1, 8),
                recurrence_type="none",
                recurrence_interval=1,
                family_id=family.id,
                assigned_to=users[0].id,
                created_by=users[0].id,
                category="school",
                action_label="Reminder set",
            ),
            Task(
                title="Take out trash",
                description="Kitchen and recycling",
                priority="low",
                status="pending",
                due_date=datetime_offset(0, 20),
                reminder_date=datetime_offset(0, 19),
                recurrence_type="weekly",
                recurrence_interval=1,
                family_id=family.id,
                assigned_to=users[3].id,
                created_by=users[0].id,
                category="chore",
            ),
            Task(
                title="Clean kitchen",
                description="After dinner reset",
                priority="low",
                status="completed",
                due_date=datetime_offset(0, 21),
                reminder_date=datetime_offset(0, 20, 30),
                recurrence_type="daily",
                recurrence_interval=1,
                family_id=family.id,
                assigned_to=users[2].id,
                created_by=users[0].id,
                category="chore",
            ),
        ]
    )

    recipes = [
        Recipe(
            recipe_name="Veggie Pasta",
            description="Fast dinner using spinach before expiry.",
            ingredients=["spinach", "tomato", "pasta", "olive oil"],
            instructions="Saute vegetables, boil pasta, combine with olive oil.",
            prep_time=10,
            cook_time=18,
            servings=4,
            difficulty="easy",
            cuisine="Italian",
            dietary_tags=["vegetarian", "uses-expiring-items"],
            family_id=family.id,
            created_by=users[0].id,
        ),
        Recipe(
            recipe_name="Couscous Lentil Salad",
            description="Protein-forward lunch from the weekly meal template.",
            ingredients=["couscous", "lentils", "cucumber", "lemon"],
            instructions="Cook couscous, fold in lentils and vegetables, finish with lemon.",
            prep_time=12,
            cook_time=10,
            servings=3,
            difficulty="easy",
            cuisine="Mediterranean",
            dietary_tags=["meal-template"],
            family_id=family.id,
            created_by=users[0].id,
        ),
    ]
    db.add_all(recipes)
    db.flush()

    week_start = start_of_week()
    meal_order = ["breakfast", "lunch", "snacks", "dinner"]
    for day_index, (day_name, meals) in enumerate(MEAL_NAMES.items()):
        plan_date = week_start + timedelta(days=day_index)
        for meal_index, meal_type in enumerate(meal_order):
            meal_name = meals[meal_type]
            db.add(
                MealPlanTemplate(
                    template_name="Default Weekly Meal Plan",
                    day_of_week=day_name.lower(),
                    meal_type=meal_type,
                    meal_name=meal_name,
                    description=f"{day_name} {meal_type} template",
                    calories=260 + day_index * 25 + meal_index * 40,
                    prep_time=10 + meal_index * 8,
                    family_id=family.id,
                    template_scope=f"family:{family.id}",
                    is_global=False,
                    created_by=users[0].id,
                )
            )
            db.add(
                MealPlan(
                    family_id=family.id,
                    plan_date=plan_date,
                    day_of_week=day_name,
                    meal_type=meal_type,
                    meal_name=meal_name,
                    description=f"{day_name} {meal_type} template",
                    calories=260 + day_index * 25 + meal_index * 40,
                    prep_time=10 + meal_index * 8,
                    color_class=DAY_COLORS[day_name],
                    created_by=users[0].id,
                    meal_plan_scope="family",
                )
            )

    db.add_all(
        [
            Notification(
                user_id=users[0].id,
                family_id=family.id,
                title="Milk expires tomorrow",
                message="Use it for breakfast or add a replacement to the NTUC run.",
                type="grocery",
                is_read=False,
                created_at=datetime_offset(0, 7, 15),
            ),
            Notification(
                user_id=users[0].id,
                family_id=family.id,
                title="Leave buffer required",
                message="School event has a 22 minute drive and traffic is building.",
                type="task",
                is_read=False,
                created_at=datetime_offset(0, 7, 30),
            ),
            Notification(
                user_id=users[0].id,
                family_id=family.id,
                title="Meal suggestion ready",
                message="Veggie pasta uses expiring spinach and pantry pasta.",
                type="meal",
                is_read=True,
                created_at=datetime_offset(-1, 18, 20),
            ),
        ]
    )

    db.add_all(
        [
            Announcement(
                family_id=family.id,
                title="Family gathering this weekend",
                message="Vote on lunch menu and confirm headcount.",
                owner_id=users[0].id,
                created_at=datetime_offset(-1, 20),
                tag="planning",
            ),
            Announcement(
                family_id=family.id,
                title="Guest visit on Saturday",
                message="Prepare spare room and add fruit to NTUC list.",
                owner_id=users[1].id,
                created_at=datetime_offset(-2, 19, 30),
                tag="home",
            ),
        ]
    )

    db.add_all(
        [
            EmergencyContact(family_id=family.id, label="Ambulance", value="995"),
            EmergencyContact(family_id=family.id, label="Police", value="999"),
            EmergencyContact(family_id=family.id, label="Fire", value="995"),
        ]
    )

    db.commit()

    if dialect == "postgresql":
        db.execute(_text("SELECT pg_advisory_unlock(123456789)"))
