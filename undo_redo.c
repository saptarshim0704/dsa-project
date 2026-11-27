/*
 * Undo / Redo for a text editor, simulated with two stacks.
 *
 * Each stack entry stores the ACTION (type + text), not a full snapshot:
 *   INSERT -> text was appended
 *   DELETE -> text was removed from the end
 *
 * Compile:  gcc undo_redo.c -o undo_redo
 * Run:      ./undo_redo        (Windows: undo_redo.exe)
 */
#include <stdio.h>
#include <string.h>

#define MAX_TEXT  1000
#define MAX_STACK 50          /* history limit */
#define INSERT    1
#define DELETE    2

typedef struct {
    int  type;
    char data[MAX_TEXT];
} Action;

typedef struct {
    Action items[MAX_STACK];
    int    top;               /* -1 means empty */
} Stack;

/* ---------- Stack operations (all O(1) except the shift in push) ---------- */
void init(Stack *s)            { s->top = -1; }
int  isEmpty(Stack *s)         { return s->top == -1; }
int  isFull(Stack *s)          { return s->top == MAX_STACK - 1; }
Action *peek(Stack *s)         { return &s->items[s->top]; }

void push(Stack *s, Action a) {
    if (isFull(s)) {          /* drop the oldest entry to stay within the limit */
        for (int i = 1; i <= s->top; i++) s->items[i - 1] = s->items[i];
        s->top--;
    }
    s->items[++s->top] = a;
}

Action pop(Stack *s)           { return s->items[s->top--]; }

/* ---------- Editor state ---------- */
char  text[MAX_TEXT] = "";
Stack undoStack, redoStack;

void appendText(const char *s)  { strcat(text, s); }
void removeLast(int n)          { text[strlen(text) - n] = '\0'; }

/* Apply an action in the forward direction. */
void applyAction(Action *a) {
    if (a->type == INSERT) appendText(a->data);
    else                   removeLast((int)strlen(a->data));
}

/* Apply the opposite of an action. */
void reverseAction(Action *a) {
    if (a->type == INSERT) removeLast((int)strlen(a->data));
    else                   appendText(a->data);
}

/* ---------- User operations ---------- */
void doInsert(const char *s) {
    if (strlen(s) == 0)                         { printf("Nothing to add.\n"); return; }
    if (strlen(text) + strlen(s) >= MAX_TEXT)   { printf("Text too long.\n");  return; }

    Action a; a.type = INSERT; strcpy(a.data, s);
    applyAction(&a);
    push(&undoStack, a);
    init(&redoStack);                           /* a new edit clears redo */
    printf("Added \"%s\".\n", s);
}

void doDelete(int n) {
    int len = (int)strlen(text);
    if (len == 0) { printf("Document is empty.\n"); return; }
    if (n < 1)    { printf("Enter a number of 1 or more.\n"); return; }
    if (n > len)  n = len;

    Action a; a.type = DELETE;
    strcpy(a.data, text + len - n);             /* remember what we remove */
    applyAction(&a);
    push(&undoStack, a);
    init(&redoStack);
    printf("Deleted %d character(s).\n", n);
}

void doUndo(void) {
    if (isEmpty(&undoStack)) { printf("Nothing to undo.\n"); return; }
    Action a = pop(&undoStack);
    reverseAction(&a);
    push(&redoStack, a);
    printf("Undo done.\n");
}

void doRedo(void) {
    if (isEmpty(&redoStack)) { printf("Nothing to redo.\n"); return; }
    Action a = pop(&redoStack);
    applyAction(&a);
    push(&undoStack, a);
    printf("Redo done.\n");
}

/* ---------- Display ---------- */
void showStack(const char *name, Stack *s) {
    printf("  %s (top first): ", name);
    if (isEmpty(s)) { printf("[empty]\n"); return; }
    for (int i = s->top; i >= 0; i--)
        printf("[%c \"%s\"] ", s->items[i].type == INSERT ? '+' : '-', s->items[i].data);
    printf("\n");
}

void showState(void) {
    printf("\n  Text: \"%s\"\n", text);
    showStack("Undo stack", &undoStack);
    showStack("Redo stack", &redoStack);
}

/* ---------- Main menu ---------- */
int main(void) {
    char line[MAX_TEXT + 10];
    int  choice, n;

    init(&undoStack);
    init(&redoStack);

    while (1) {
        printf("\n===== Text Editor: Undo / Redo =====\n");
        printf("1. Add text\n2. Delete last N characters\n3. Undo\n4. Redo\n5. Show text and stacks\n6. Exit\n");
        printf("Choice: ");

        if (!fgets(line, sizeof line, stdin) || sscanf(line, "%d", &choice) != 1) {
            printf("Enter a number from 1 to 6.\n");
            continue;
        }

        switch (choice) {
            case 1:
                printf("Text to add: ");
                if (fgets(line, sizeof line, stdin)) {
                    line[strcspn(line, "\n")] = '\0';
                    doInsert(line);
                }
                break;
            case 2:
                printf("How many characters: ");
                if (fgets(line, sizeof line, stdin) && sscanf(line, "%d", &n) == 1) doDelete(n);
                else printf("Enter a number of 1 or more.\n");
                break;
            case 3: doUndo(); break;
            case 4: doRedo(); break;
            case 5: break;                      /* state is shown below */
            case 6: printf("Goodbye.\n"); return 0;
            default: printf("Enter a number from 1 to 6.\n");
        }
        showState();
    }
}
