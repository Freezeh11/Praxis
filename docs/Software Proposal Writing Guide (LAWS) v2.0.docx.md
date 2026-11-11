## **Team Information**

**Project Title**: Praxis

**Project Short Description**: An interactive web-based platform that develops proficiency in the simplification of logic expressions using Boolean laws and theorems in first-year CCS  students.

**Team Code:** 2526-sem2-it332-25

**Members**:

1\. Kurt Derrick G. Basalo  
2\. Christian Jay B. Basinillo  
3\. Vince Astly N. Cabungcag  
4\. Gabriel Lyle Z. Espelita  
5\. Primo Christian C. Montejo

## **PART 1: Introduction**

Digital logic and Boolean reasoning form the foundation of modern computing, yet mastering the procedural application of equivalence laws remains a significant hurdle for students. A persistent gap exists between passive law recognition and the capacity to simplify complex expressions. In the Philippine IT context, Del Carmen et al. (2026) empirically identified this as the "Fixing vs. Foundation" gap. Their study found that while BSIT students are highly proficient in physical troubleshooting (mean: 3.70), performance drops significantly during foundational mathematical phases like Boolean derivation (mean: 3.32). Similarly, Bulaclac et al. (2026) observed that students struggle with abstract logic optimization such as applying "Don't Care" conditions (mean: 3.43). These findings confirm that students often treat logic simplification as a hurdle rather than a tool, resorting to trial-and-error assembly when their logical blueprints are weak.

This is not just a local issue. Herman et al. (2012) conducted think-aloud interviews with computing students who had recently completed a digital logic design course and found that translating verbal problem statements into Boolean expressions is one of the hardest procedural skills for students to develop. More importantly, their study found that students performed significantly better when the problem format guided them through structured steps rather than leaving them to figure it out on their own. This finding directly informs the design of Praxis: how a problem is presented shapes whether students apply the right reasoning or not.

Part of the problem is also how students study. Broeren et al. (2021) found that students tend to gravitate toward passive review because it feels like progress, even when it does little to build actual skill. Stanton, Sebesta, and Dunlosky (2021) add that students often avoid effortful practice because it is uncomfortable and exposes what they do not know. Without a mechanism that pushes them to actively engage with expressions at the literal and term level, students stay at the surface level, and that surface-level understanding breaks down fast when multi-step simplification problems appear in assessments.

The research gap this project addresses is the absence of an accessible, interactive platform that develops Boolean algebra simplification skills through a structured, physically manipulative practice cycle. Current tools present Boolean logic content passively or require instructor involvement. No accessible student-facing system currently combines a three-level difficulty progression scaled by variable count, a dual-mode click interface for literal-level and term-level law application, a contextual hint and guide system, and multi-step intermediate state rendering in a single interactive environment designed for self-directed Boolean simplification practice. Praxis aims to fill this void by bridging the documented "Fixing vs. Foundation" gap and transforming abstract laws into mastered procedural skills through active physical manipulation and immediate structural feedback.

## **PART 2: Objectives**

Praxis is an interactive web-based Boolean algebra simplification trainer for first-year CCS students. Users are presented with unsimplified Boolean expressions and must simplify them by directly clicking on literals and terms within the live expression to identify and apply the correct equivalence law at each step. The system guides users through a three-level progression scaled by variable count: Level 1 uses two-variable expressions, Level 2 uses three-variable expressions, and Level 3 presents four-variable expressions as a boss-tier challenge. All levels have all Boolean laws available for use, and the Reward and Guide System is available for all levels. The four general objectives below follow the sequential order of system development.

# **General Objective 1: Implement the Reward, Hints, and Guide System**

Develop and integrate a combined Reward and Guide System that encourages sustained, self-directed practice. The Reward System allows users to gain points after answering a problem, which can be used to purchase support from the Guide System, which guides the users towards a correct move to prevent them from being stuck on a problem. Worded hints are different from the guide system’s hints; they provide hints on the specific problems that they are solving.

### **Specific Objectives for GO 1:**

* Develop the **Reward System** to award points upon correct completion of a problem.

* Implement a point expenditure mechanism allowing users to use earned points to purchase a hint from the Guide System, ensuring that users utilize the hint system purposefully.

* Implement the **Guide System** as a smart hint engine that remains dormant while the student is actively engaging with the expression and activates only after the user purchases a hint, providing contextual, visually highlighted law cues that guide users toward the correct simplification strategy.

* Implement a **Worded Hint System** that is specific to different scenarios that the user is currently facing, which provides them context on what to do.

* Develop a globally accessible Law Reference screen accessible from the navigation header at any point during a puzzle session, displaying all Boolean equivalence laws as reference cards showing the law name, formula forms, and a plain-language description.

# **General Objective 2: Implement the Level 1 Challenge (2-Variable Expressions)**

Develop the Level One stage, featuring two-variable Boolean expressions, designed to introduce the core interactive expression manipulation interface and build proficiency in foundational law application.

### **Specific Objectives for GO 2:**

* Implement the first level that presents two-variable Boolean expressions, covering all applicable laws in a two-variable expression.

* Implement a minimum of six problems in Level 1, ensuring that scenarios exist where different laws are applicable.

* Develop a dual-mode selection interface where users physically select variables, literals, and terms within the live expression to identify and apply Boolean laws themselves, allowing for both literal-level and term-level operations.

* Implement a level-unlock mechanism that restricts access to the next level until the user completes the current level.

* Ensure that the Reward and Guide systems are fully functional and available to users throughout all Level 1 problems.

# **General Objective 3: Implement the Level 2 Challenge (3-Variable Expressions)**

Develop the Level Two stage, featuring three-variable Boolean expressions, requiring users to apply a variety of structural manipulation laws across increasingly complex simplification chains.

### **Specific Objectives for GO 3:**

* Implement the second level that presents three-variable Boolean expressions requiring structural manipulation laws such as Associative and Distributive (including POS dual distribution).

* Implement a minimum of six problems in Level 2, ensuring that scenarios exist where different laws are applicable.

* Ensure that the Reward and Guide systems are fully functional and available to users throughout all Level 2 problems

# **General Objective 4: Implement the Level 3 Challenge Module (4-Variable Expressions)**

Develop the last challenge level (Level 3\) featuring four-variable expressions, requiring the integrated, multi-step application of laws. This level will test the user’s skills by handling 4-variable expressions across different problem using all applicable laws

### **Specific Objectives for GO 4:**

* Implement the third level that presents a four-variable expression challenge requiring the integrated application of multiple laws across a full multi-step simplification chain.

* Implement a minimum of six problems in Level 3, ensuring that scenarios exist where different laws are applicable.

## **Research Questions**

* To what extent does completing the Praxis interactive expression manipulation challenges improve student accuracy on multi-step Boolean simplification problems, measured as the difference between pre-intervention and post-intervention puzzle completion accuracy scores across the three-level progressive challenge system?

* Which specific Boolean equivalence laws produce the highest initial incorrect application rates among first-year CCS student participants across the three difficulty levels, and does targeted interactive practice through the dual-mode selection interface reduce these law-specific error rates by at least 20 percentage points on subsequent attempts?

* To what degree does Praxis achieve a mean perceived usability and usefulness score of at least 4.0 out of 5.0 among first-year CCS student participants as measured through a structured User Acceptance Testing instrument.

## **PART 3: Methods**

## **Proposed Solution Concept**

Praxis is an interactive web-based Boolean algebra simplification trainer designed for individual use by first-year CCS college students enrolled in courses featuring digital logic and Boolean algebra. The platform is built around four core modules corresponding to the four general objectives: a three-level progressive challenge module, a dual-mode expression manipulation interface, a contextual hint and guide system, and a step-by-step intermediate state rendering engine. The system's core interaction cycle works as follows: a student selects a level from the Level Select screen, reads the unsimplified Boolean expression presented on the puzzle screen, clicks on a literal, term handle, or negation node within the live expression to select it, selects the applicable law from the contextual law panel that appears, and observes the expression transform to its next intermediate state. The student continues applying laws step by step until the expression is fully simplified. All Level 1 problems use two distinct variables, Level 2 problems use three distinct variables, and Level 3 boss problems use four distinct variables. The primary measurable outcome is the improvement in correct law application accuracy between the student's first and most recent attempt on each level.

## **Development Methodology**

The system will be developed using the Agile methodology with an iterative sprint-based approach. Development will proceed across four sprints each corresponding to a core module: the three-level progressive challenge structure and Level Select screen, the dual-mode expression manipulation interface with literal-click and term-handle interaction, the contextual hint and guide system and Law Reference screen, and the step-by-step intermediate state rendering engine with step history panel. This approach allows for continuous UI/UX testing of the expression interaction mechanics before the complexity of higher-level Boolean problems is introduced. Each sprint concludes with a functional review and testing cycle, and feedback is incorporated before the following sprint begins.

## **Validation Approach**

The system will be evaluated using two complementary approaches. First, a within-system accuracy tracking measurement will compare each student's initial puzzle accuracy against their most recent attempt accuracy per level, with a target improvement threshold of at least 20 percentage points on law-specific error rates and a target post-practice accuracy of at least 80% correct law applications for level completion. Law-specific error rates per Boolean equivalence law will be recorded to identify which specific laws produce the highest initial incorrect application rates among participants. Second, a usability evaluation will be conducted using a structured User Acceptance Testing instrument measuring perceived ease of use, perceived usefulness, and overall satisfaction among first-year CCS student participants, with a target mean score of at least 4.0 out of 5.0.

## **PART 4: Expected System**

## **Part A: Key Features (Minimum Viable Product)**

### **Module 1:  Three-Level Progressive Challenge System**

The Level Select screen presents three challenge levels as nodes on a horizontal carousel with arrow and swipe navigation. Level 1 presents two-variable Boolean expressions covering foundational single-law applications. Level 2 presents three-variable expressions requiring structural manipulation laws such as Associative and Distributive (including POS dual distribution). Level 3 presents four-variable expressions as a boss-tier challenge requiring the integrated application of multiple laws across a full multi-step simplification chain. Each level contains twelve problems — six SOP and six POS dual-pair stages — each requiring a distinct primary Boolean law, ensuring that students cannot pass a level by mastering only one law. Each stage awards a one-to-three star rating based on the stage score, aggregated per level as the student's total stars. The next level unlocks only when the student meets the 80% accuracy threshold on the current level.

### **Module 2: Dual-Mode Expression Manipulation Interface**

The core interaction model presents the unsimplified Boolean expression as a live, structured tree of clickable nodes. Students interact with the expression in two modes. In literal mode, the student clicks an individual variable literal within a term. The system then highlights the selection and displays a contextual panel showing only the laws applicable at the literal level, such as Distributive factoring, Complement, and Double Negation. In term mode, the student clicks the drag handle (⠿) of a term. This action highlights the entire term and displays only the laws applicable at the term level, such as Idempotent, Absorption, Identity, and Annulment. Negated compound sub-expressions such as (A · B)' are directly clickable to trigger De Morgan's Law. The student selects the applicable law from the contextual panel, and the expression transforms to its next intermediate state. 

### **Module 3: Hint and Guide System**

Every problem includes worded hints specific to the current scenario, shown when the student presses the Hint button. In addition, the Guide System is purchased with earned points (20 points per use) and visually highlights — with a color-coded pulse animation — the exact literals or terms involved in an applicable law, without revealing the correct selection or the resulting expression. Students may also open the Law Reference screen from the navigation header at any point, which displays all Boolean equivalence laws as reference cards showing the law name, formula forms, and a plain-language description. Students return to their current puzzle state without penalty.

### **Module 4: Step-by-Step Intermediate State Rendering Engine**

All law applications that produce a constant factor within a product or sum use structure-preserving normalization so that intermediate expressions are rendered as distinct, clickable states. For example, applying Distributive Law to y(x \+ x') produces y(x \+ x') as State 1, then y · 1 as State 2 after the student applies Complement Law to (x \+ x'), then y as State 3 after the student applies Identity Law to y · 1\. The student must explicitly click and apply each subsequent law to advance through every intermediate state. A step history panel displays the complete sequence of intermediate expressions alongside the law name applied at each step, allowing the student to review their full reasoning chain at any point during the puzzle.

## **Part B: High-Level System Workflow**

A student opens Praxis and views the Level Select screen showing the three-level horizontal carousel. The student selects Level 1\. The puzzle screen loads showing the unsimplified Boolean expression as a structured interactive tree. The student clicks a literal within the expression. The system highlights the selection and displays the contextual law panel showing only the laws applicable to that selection. The student selects the applicable law. The expression transforms to the next intermediate state. If no law applies to a selection, the student is prompted to try a different selection, keeping every applied step lawfully valid. The student continues applying laws step by step until the expression is fully simplified. The step history panel updates after each application. If the student is stuck, they may press the Hint button for a worded hint or spend 20 points on the Guide, which highlights the relevant literals or terms. After each problem, a completion modal displays the student's score breakdown (efficiency, target laws, hint independence) and the stage's star rating. If the 80% accuracy threshold is met, the next level unlocks. The student may replay any level at any time. 

## **PART 5: Discussion**

## **Scope**

Praxis is strictly scoped to the interactive practice of Boolean Equivalence Laws and Expression Simplification for first-year CCS college students in digital logic and discrete mathematics courses. The curriculum covers ten interactive law cards applied across three difficulty levels: Identity, Annulment, Idempotent, Double Negation, Associative, Complement, Absorption, De Morgan's (AND→OR and OR→AND), and Distributive (factoring and POS dual) laws. Level 1 uses two-variable expressions, Level 2 uses three-variable expressions, and Level 3 uses four-variable expressions. The platform is designed for single-user, self-directed practice and does not include instructor dashboards, institutional grading integration, or formal curriculum management. The performance measurement operates entirely within the system's own interactive puzzle attempts.

## **Limitations**

The accuracy improvement demonstrated within Praxis reflects performance on the system's own interactive expression manipulation problems and cannot be directly equated to performance on institutional examinations, which may differ in format and context. The effectiveness of the practice cycle depends on genuine student engagement with the dual-mode selection interface; students who click randomly without reasoning will not develop meaningful simplification skills. The four-variable constraint in Level 3 limits the cognitive complexity of expressions compared to real-world Boolean problems that may involve more variables. The usability evaluation will also be limited by the number of first-year CCS student participants the team can realistically recruit during the testing period. The platform intentionally excludes Karnaugh maps, truth table construction, combinational circuit design, sequential logic, and hardware description languages to maintain a laser focus on algebraic simplification using equivalence laws. While Bulaclac et al. (2026) noted that students also struggle significantly with K-map reduction, Praxis omits graphical minimization to prioritize the algebraic laws as the cognitive root required before students transition to more complex optimization techniques.

## **Expected Contribution**

Praxis directly addresses the "Fixing vs. Foundation" gap empirically identified by Del Carmen et al. (2026) within the Philippine IT education context. By requiring students to physically manipulate live Boolean expressions at the literal and term level and explicitly apply each law to each intermediate state, the platform provides a structured interactive environment where students validate their logical blueprints step by step. Herman et al. (2012) demonstrated that students perform significantly better when constrained to structured problem formats. The dual-mode selection interface and step-locking mechanism directly implement this finding by constraining students to apply laws procedurally rather than guessing at final answers. Broeren et al. (2021) established that students default to passive strategies that fail to develop applied skill, and Stanton et al. (2021) demonstrated that structured effortful practice is necessary to close the recognition-to-application gap. The physical click-based interaction model addresses both findings by making passive engagement impossible within the system. Kuklick et al. (2023) established that elaborated contextual feedback reduces frustration and improves metacognitive accuracy. The adaptive hint system and step history panel implement this without revealing the correct answer. 

## **PART 6: Traceability Matrix**

| RRL Finding/Theme | Identified Gap | Research Question | Proposed Function |
| :---- | :---- | :---- | :---- |
| Students default to passive review strategies because they feel productive, even when failing to build actual applied skill in Boolean simplification (Broeren et al., 2021). | No accessible tool forces active, physical engagement with live Boolean expressions during self-directed study, leaving the recognition-to-application gap unaddressed. | RQ1: To what extent does completing Praxis interactive manipulation challenges improve student accuracy on multi-step Boolean simplification problems? | Dual-Mode Expression Manipulation Interface (GO2): Students physically click literals, term handles, and negation nodes within the live expression to apply laws, making passive engagement structurally impossible. |
| Students avoid effortful practice because it exposes uncomfortable knowledge gaps and requires higher cognitive effort than passive review (Stanton et al., 2021). | No interactive platform structures Boolean simplification as a progressively scaled three-level path that makes effort-to-mastery progress directly visible through completion status and star ratings. | RQ1: To what extent does completing Praxis interactive manipulation challenges improve student accuracy on multi-step Boolean simplification problems? | Three-Level Progressive Challenge System (GO1): Level 1 to Level 3 progression scaled by variable count (2→3→4) with 80% accuracy threshold for level unlock; Level Select screen displays completion status and star rating per level. |
| Students performed significantly better when Boolean problems were structured with guided steps; translating verbal statements to Boolean expressions is the hardest procedural skill to develop (Herman et al., 2012). | No accessible interactive tool constrains students to apply Boolean laws procedurally at each intermediate step, preventing students from skipping directly to a guessed final form. | RQ1: To what extent does completing Praxis interactive manipulation challenges improve student accuracy on multi-step Boolean simplification problems? | Step-by-Step Intermediate State Rendering Engine (GO4): Structure-preserving normalization renders each intermediate expression state as a distinct clickable node; step-locking requires explicit law application at every intermediate stage before the expression advances. |
| BSIT students show significantly lower mastery in foundational Boolean derivation (mean: 3.32) compared to troubleshooting proficiency (mean: 3.70), creating a documented "Fixing vs. Foundation" gap (Del Carmen et al., 2026). | Students treat logic simplification as a hurdle and rely on trial-and-error rather than sound logical blueprints; no tool addresses this through forced step-by-step physical law execution. | RQ2: Which specific Boolean laws produce the highest initial error rates, and does interactive practice reduce these rates by at least 20 percentage points? | Dual-Mode Interface \+ Step-Locking (GO2, GO4): Physical literal and term selection constrains students to commit to one law at a time; step-locking prevents skipping to memorize final answers, forcing genuine reasoning at each intermediate state. |
| Students struggle with abstract optimization concepts (mean: 3.43) despite recognizing their career relevance; K-map and optimization skills require algebraic laws as a cognitive root (Bulaclac et al., 2026). | Curricula lack interactive tools that isolate and develop the algebraic equivalence laws as the foundational mental framework required before students transition to more complex optimization techniques. | RQ2: Which specific Boolean laws produce the highest initial error rates, and does interactive practice reduce these rates by at least 20 percentage points? | Three-Level Progressive Challenge System (GO1): Six problems per level each requiring a distinct primary law ensure comprehensive law coverage; the level structure is laser-focused on algebraic simplification before optimization topics are introduced. |
| Elaborated computer-based feedback significantly improves metacognitive accuracy compared to simple error flags; students who receive no guidance after incorrect responses experience frustration that reduces motivation (Kuklick et al., 2023). | No interactive Boolean simplification tool provides context-aware, on-demand visual law cues that guide the student toward the applicable law without revealing the correct selection or resulting expression. | RQ3: To what degree does Praxis achieve a mean perceived usability score of at least 4.0 out of 5.0? | Hint and Guide System (GO3): Worded problem-specific hints available on demand; a point-purchased Guide uses a color-coded pulse animation to highlight the exact relevant literals or terms without revealing the correct answer or expression. |
| Contextual, structured feedback during active problem solving improves both accuracy and student willingness to re-engage with difficult problems (Kuklick et al., 2023; Morris et al., 2021). | No interactive Boolean simplification tool provides a persistent, globally accessible law reference that students can consult during a live puzzle session without losing their current simplification state. | RQ3: To what degree does Praxis achieve a mean perceived usability score of at least 4.0 out of 5.0? | Law Reference Screen \+ Step History Panel (GO3, GO4): Law Reference screen accessible from header at any point without penalty; step history panel displays the complete sequence of intermediate expressions and laws applied so far in the current puzzle. |
|  |  |  |  |

## **PART 7: References**

1. Broeren, M., Heijltjes, A., Verkoeijen, P., Smeets, G., & Arends, L. (2021). Supporting the self-regulated use of retrieval practice: A higher education classroom experiment. Contemporary Educational Psychology, 64, 101939\. https://doi.org/10.1016/j.cedpsych.2020.101939

2. Bulaclac, J. R., Del Carmen, J. R., Pascual, V. C., Padre, J. M., & Leona, R. F. (2026). Evaluating Technical Competency and Practical Utility in Logic Gate Integration: A Case Study of BSIT Students at the NEUST Main Campus. Multidisciplinary International Journal of Research and Development (MIJRD), 5(3), 109–118. https://www.mijrd.com/papers/technical-competency-practical-utility-logic-gate-integration-bsit-neust

3. Del Carmen, J. R., Bulaclac, J. R., Santiago, E. T., Suarez, C. B., Santiago, J. D., Alberto, J. G., & Sison, R. B. (2026). Perceived Usefulness of Logic Circuit Design in Enhancing Technical Proficiency Among BSIT Students in Nueva Ecija University of Science and Technology-Peñaranda Off-Campus. International Journal of Scientific Research and Engineering Development (IJSRED), 9(1), 846–852. https://doi.org/10.5281/zenodo.18621522

4. Herman, G. L., Loui, M. C., Kaczmarczyk, L., & Zilles, C. (2012). Describing the what and why of students' difficulties in Boolean logic. ACM Transactions on Computing Education, 12(1), Article 3\. https://doi.org/10.1145/2133797.2133800

5. Ifenthaler, D., Schumacher, C., & Kuzilek, J. (2023). Investigating students' use of self-assessments in higher education using learning analytics. Journal of Computer Assisted Learning, 39(1), 255–268. https://doi.org/10.1111/jcal.12744

6. Kuklick, L., Greiff, S., & Lindner, M. A. (2023). Computer-based performance feedback: Effects of error message complexity on cognitive, metacognitive, and motivational outcomes. Computers and Education, 200, Article 104785\. https://doi.org/10.1016/j.compedu.2023.104785

7. Morris, R., Perry, T., & Wardle, L. (2021). Formative assessment and feedback for learning in higher education: A systematic review. Review of Education, 9(3), Article e3292. https://doi.org/10.1002/rev3.3292

8. Stanton, J. D., Sebesta, A. J., & Dunlosky, J. (2021). Fostering metacognition to support student learning and performance. CBE — Life Sciences Education, 20(2), Article fe3. https://doi.org/10.1187/cbe.20-12-0289 

