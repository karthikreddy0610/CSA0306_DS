#include "employee.h"

// Initialize Database for Separate Chaining
ChainingTable* init_chaining_db() {
    ChainingTable* db = (ChainingTable*)malloc(sizeof(ChainingTable));
    db->table = (Node**)malloc(TABLE_SIZE * sizeof(Node*));
    for (int i = 0; i < TABLE_SIZE; i++) {
        db->table[i] = NULL;
    }
    return db;
}

// Initialize Database for Open Addressing
OpenAddrTable* init_open_db() {
    OpenAddrTable* db = (OpenAddrTable*)malloc(sizeof(OpenAddrTable));
    db->table = (int*)malloc(TABLE_SIZE * sizeof(int));
    db->occupied = (bool*)malloc(TABLE_SIZE * sizeof(bool));
    for (int i = 0; i < TABLE_SIZE; i++) {
        db->occupied[i] = false;
    }
    return db;
}

// Free memory for Chaining Table
void free_chaining_db(ChainingTable* db) {
    if (!db) return;
    for (int i = 0; i < TABLE_SIZE; i++) {
        Node* current = db->table[i];
        while (current != NULL) {
            Node* temp = current;
            current = current->next;
            free(temp);
        }
    }
    free(db->table);
    free(db);
}

// Free memory for Open Addressing Table
void free_open_db(OpenAddrTable* db) {
    if (!db) return;
    free(db->table);
    free(db->occupied);
    free(db);
}
