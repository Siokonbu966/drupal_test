<?php

namespace Drupal\notes_app\Controller;

use Drupal\Core\Controller\ControllerBase;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Drupal\node\NodeInterface;
use Drupal\node\Entity\Node;
use Drupal\Core\Access\AccessResult;

/**
 * Controller for the Notes Web Application.
 */
class NotesController extends ControllerBase {

  /**
   * Serves the single-page HTML frontend.
   */
  public function index() {
    $module_path = \Drupal::service('extension.list.module')->getPath('notes_app');
    $csrf_token = \Drupal::csrfToken()->get('notes_app_api');

    $html = <<<HTML
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Premium Notes App</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Noto+Sans+JP:wght@300;400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/{$module_path}/css/styles.css">
    <meta name="csrf-token" content="{$csrf_token}">
</head>
<body>
    <div id="app">
        <!-- App container will be populated by JS -->
        <div class="loader-container">
            <div class="loader"></div>
            <p>Loading your space...</p>
        </div>
    </div>
    <script src="/{$module_path}/js/app.js" defer></script>
</body>
</html>
HTML;

    return new Response($html, 200, [
      'Content-Type' => 'text/html; charset=UTF-8',
    ]);
  }

  /**
   * Retrieves notes for the logged-in user.
   */
  public function getNotes() {
    try {
      $storage = \Drupal::entityTypeManager()->getStorage('node');
      
      // Query notes
      $query = $storage->getQuery()
        ->condition('type', 'note')
        ->condition('status', 1)
        ->sort('changed', 'DESC')
        ->accessCheck(FALSE); // In this local demo app, we allow access to notes.
        
      $nids = $query->execute();
      $nodes = $storage->loadMultiple($nids);
      
      $notes = [];
      foreach ($nodes as $node) {
        /** @var \Drupal\node\NodeInterface $node */
        $notes[] = [
          'id' => $node->id(),
          'title' => $node->getTitle(),
          'body' => $node->get('body')->value ?? '',
          'color' => $node->get('field_color')->value ?? '#ffffff',
          'category' => $node->get('field_category')->value ?? 'General',
          'created' => $node->getCreatedTime(),
          'changed' => $node->getChangedTime(),
        ];
      }
      
      return new JsonResponse($notes);
    }
    catch (\Exception $e) {
      return new JsonResponse(['error' => $e->getMessage()], 500);
    }
  }

  /**
   * Creates a new note node.
   */
  public function createNote(Request $request) {
    try {
      $data = json_decode($request->getContent(), TRUE);
      if (empty($data['title'])) {
        return new JsonResponse(['error' => 'Title is required'], 400);
      }

      $node = Node::create([
        'type' => 'note',
        'title' => $data['title'],
        'body' => [
          'value' => $data['body'] ?? '',
          'format' => 'plain_text',
        ],
        'field_color' => $data['color'] ?? '#ffffff',
        'field_category' => $data['category'] ?? 'General',
        'status' => 1,
      ]);
      $node->save();

      return new JsonResponse([
        'id' => $node->id(),
        'title' => $node->getTitle(),
        'body' => $node->get('body')->value ?? '',
        'color' => $node->get('field_color')->value ?? '#ffffff',
        'category' => $node->get('field_category')->value ?? 'General',
        'created' => $node->getCreatedTime(),
        'changed' => $node->getChangedTime(),
      ], 201);
    }
    catch (\Exception $e) {
      return new JsonResponse(['error' => $e->getMessage()], 500);
    }
  }

  /**
   * Updates an existing note node.
   */
  public function updateNote(Request $request, NodeInterface $node) {
    // Ensure node type is note
    if ($node->bundle() !== 'note') {
      return new JsonResponse(['error' => 'Invalid node type'], 400);
    }

    try {
      $data = json_decode($request->getContent(), TRUE);
      
      if (isset($data['title'])) {
        $node->setTitle($data['title']);
      }
      if (isset($data['body'])) {
        $node->get('body')->value = $data['body'];
      }
      if (isset($data['color'])) {
        $node->get('field_color')->value = $data['color'];
      }
      if (isset($data['category'])) {
        $node->get('field_category')->value = $data['category'];
      }
      
      $node->save();

      return new JsonResponse([
        'id' => $node->id(),
        'title' => $node->getTitle(),
        'body' => $node->get('body')->value ?? '',
        'color' => $node->get('field_color')->value ?? '#ffffff',
        'category' => $node->get('field_category')->value ?? 'General',
        'created' => $node->getCreatedTime(),
        'changed' => $node->getChangedTime(),
      ]);
    }
    catch (\Exception $e) {
      return new JsonResponse(['error' => $e->getMessage()], 500);
    }
  }

  /**
   * Deletes a note node.
   */
  public function deleteNote(Request $request, NodeInterface $node) {
    // Ensure node type is note
    if ($node->bundle() !== 'note') {
      return new JsonResponse(['error' => 'Invalid node type'], 400);
    }

    try {
      $node->delete();
      return new JsonResponse(['success' => TRUE]);
    }
    catch (\Exception $e) {
      return new JsonResponse(['error' => $e->getMessage()], 500);
    }
  }
}
