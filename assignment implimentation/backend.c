#include "employee.h"

// Hash Function: Modulo Division
int hash_function(int emp_id) {
    return emp_id % TABLE_SIZE;
}

// 1. Separate Chaining
int insert_chaining(ChainingTable* db, int emp_id) {
    int index = hash_function(emp_id);
    int collisions = 0;
    
    Node* newNode = (Node*)malloc(sizeof(Node));
    newNode->emp_id = emp_id;
    newNode->next = db->table[index];
    
    if (db->table[index] != NULL) collisions = 1; // Count as collision if list exists
    
    db->table[index] = newNode;
    return collisions;
}

bool search_chaining(ChainingTable* db, int emp_id) {
    int index = hash_function(emp_id);
    Node* current = db->table[index];
    while (current != NULL) {
        if (current->emp_id == emp_id) return true;
        current = current->next;
    }
    return false;
}

// 2. Linear Probing
int insert_linear(OpenAddrTable* db, int emp_id) {
    int index = hash_function(emp_id);
    int collisions = 0;
    
    while (db->occupied[index]) {
        collisions++;
        index = (index + 1) % TABLE_SIZE;
        if (collisions >= TABLE_SIZE) return -1; // Table full
    }
    
    db->table[index] = emp_id;
    db->occupied[index] = true;
    return collisions;
}

bool search_linear(OpenAddrTable* db, int emp_id) {
    int start_index = hash_function(emp_id);
    int index = start_index;
    int checked = 0;
    
    while (db->occupied[index]) {
        if (db->table[index] == emp_id) return true;
        index = (index + 1) % TABLE_SIZE;
        checked++;
        if (checked >= TABLE_SIZE) break;
    }
    return false;
}

// 3. Quadratic Probing
int insert_quadratic(OpenAddrTable* db, int emp_id) {
    int start_index = hash_function(emp_id);
    int index = start_index;
    int collisions = 0;
    int i = 1;
    
    while (db->occupied[index]) {
        collisions++;
        index = (start_index + i * i) % TABLE_SIZE;
        i++;
        if (collisions >= TABLE_SIZE) return -1; // Table full
    }
    
    db->table[index] = emp_id;
    db->occupied[index] = true;
    return collisions;
}

bool search_quadratic(OpenAddrTable* db, int emp_id) {
    int start_index = hash_function(emp_id);
    int index = start_index;
    int i = 1;
    int checked = 0;
    
    while (db->occupied[index]) {
        if (db->table[index] == emp_id) return true;
        index = (start_index + i * i) % TABLE_SIZE;
        i++;
        checked++;
        if (checked >= TABLE_SIZE) break; // Avoid infinite loops
    }
    return false;
}
